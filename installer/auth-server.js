/**
 * Nexus Monitoramento - Auth Server
 * Servidor de autenticação compatível com Supabase JS Client
 * Roda junto com PostgREST para fornecer auth + REST API
 */

const http = require('http');
const { Pool } = require('pg');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const pathMod = require('path');

// Configuração
const PORT = 8001;
const JWT_SECRET = 'nexus-monitoramento-jwt-secret-key-2024-super-seguro';
const POSTGREST_URL = 'http://127.0.0.1:3000';
const CORS_HEADERS = 'authorization, x-client-info, apikey, content-type, prefer, accept, accept-profile, content-profile, range, range-unit, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';
const CORS_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'nexus',
  user: 'postgres',
  password: '' // Definido pelo instalador
});


// Evita queda total do serviço em erros transitórios de conexão
pool.on('error', (err) => {
  console.error('[PG_POOL_ERROR]', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED_REJECTION]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT_EXCEPTION]', err?.message || err);
});

// JWT simples (sem dependência externa)
function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createJWT(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${body}.${signature}`;
}

function verifyJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${parts[0]}.${parts[1]}`)
      .digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    if (signature !== parts[2]) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64').toString());
  } catch { return null; }
}

// Helpers
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': CORS_HEADERS,
    'Access-Control-Allow-Methods': CORS_METHODS
  });
  res.end(JSON.stringify(data));
}

function buildUserResponse(user, token) {
  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: 86400,
    refresh_token: token,
    user: {
      id: user.id,
      email: user.email,
      role: 'authenticated',
      aud: 'authenticated',
      created_at: user.created_at,
      updated_at: user.updated_at,
      email_confirmed_at: user.email_confirmed_at,
      user_metadata: user.raw_user_meta_data || {}
    }
  };
}

// Proxy para PostgREST
function proxyToPostgREST(req, res, path) {
  const url = new URL(path, POSTGREST_URL);

  // Copiar query string
  const originalUrl = new URL(req.url, `http://localhost:${PORT}`);
  url.search = originalUrl.search;

  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: req.method,
    headers: { ...req.headers, host: `${url.hostname}:${url.port}` }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // Add CORS headers
    const headers = { ...proxyRes.headers };
    headers['access-control-allow-origin'] = '*';
    headers['access-control-allow-headers'] = CORS_HEADERS;
    headers['access-control-allow-methods'] = CORS_METHODS;
    
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => sendJSON(res, 502, { error: 'PostgREST unavailable' }));
  req.pipe(proxyReq);
}

// Servidor principal (API Gateway compatível com Supabase)
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': CORS_HEADERS,
      'Access-Control-Allow-Methods': CORS_METHODS
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    // ---- AUTH ENDPOINTS (compatível com Supabase GoTrue) ----

    // POST /auth/v1/signup
    if (path === '/auth/v1/signup' && req.method === 'POST') {
      const { email, password } = await readBody(req);
      if (!email || !password) return sendJSON(res, 400, { error: 'Email and password required' });

      const result = await pool.query(
        `INSERT INTO auth.users (email, encrypted_password) 
         VALUES ($1, crypt($2, gen_salt('bf'))) 
         RETURNING *`,
        [email, password]
      );
      const user = result.rows[0];
      const token = createJWT({
        sub: user.id, email: user.email, role: 'authenticated',
        aud: 'authenticated',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      return sendJSON(res, 200, buildUserResponse(user, token));
    }

    // POST /auth/v1/token?grant_type=password
    if (path === '/auth/v1/token' && req.method === 'POST') {
      const { email, password } = await readBody(req);
      if (!email || !password) return sendJSON(res, 400, { error: 'Email and password required' });

      const result = await pool.query(
        `SELECT * FROM auth.users 
         WHERE email = $1 AND encrypted_password = crypt($2, encrypted_password)`,
        [email, password]
      );

      if (result.rows.length === 0) return sendJSON(res, 400, { error: 'Invalid login credentials' });
      
      const user = result.rows[0];
      const token = createJWT({
        sub: user.id, email: user.email, role: 'authenticated',
        aud: 'authenticated',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      return sendJSON(res, 200, buildUserResponse(user, token));
    }

    // GET /auth/v1/user
    if (path === '/auth/v1/user' && req.method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });

      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' });

      const result = await pool.query('SELECT * FROM auth.users WHERE id = $1', [payload.sub]);
      if (result.rows.length === 0) return sendJSON(res, 404, { error: 'User not found' });

      const user = result.rows[0];
      return sendJSON(res, 200, {
        id: user.id, email: user.email, role: 'authenticated',
        aud: 'authenticated', created_at: user.created_at,
        user_metadata: user.raw_user_meta_data || {}
      });
    }

    // POST /auth/v1/logout
    if (path === '/auth/v1/logout' && req.method === 'POST') {
      return sendJSON(res, 200, {});
    }

    // ---- SYSTEM UPDATE ENDPOINT ----
    // ---- SYSTEM UPDATE (SSE streaming) ----
    if (path === '/api/system/update' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' });

      // SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': CORS_HEADERS,
        'Access-Control-Allow-Methods': CORS_METHODS
      });

      const sendEvent = (step, status, message, detail) => {
        const data = JSON.stringify({ step, status, message, detail: detail || '' });
        res.write(`data: ${data}\n\n`);
      };

      const { execSync, spawn } = require('child_process');
      const INSTALL_DIR = process.env.INSTALL_DIR || '/opt/nexus-monitoramento';

      try {
        // Etapa 1: Backup
        sendEvent(1, 'running', 'Fazendo backup de configurações...');
        try {
          execSync(`cd ${INSTALL_DIR} && cp -f .env .env.bak 2>/dev/null || true && cp -f auth-server/server.js auth-server/server.js.bak 2>/dev/null || true`, { timeout: 10000 });
          sendEvent(1, 'done', 'Backup concluído (.env e auth-server)');
        } catch (e) {
          sendEvent(1, 'warn', 'Backup parcial', e.message);
        }

        // Etapa 2: Git checkout + pull
        sendEvent(2, 'running', 'Baixando atualizações do GitHub...');
        try {
          const branch = execSync(`cd ${INSTALL_DIR} && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main`, { timeout: 10000 }).toString().trim() || 'main';
          execSync(`cd ${INSTALL_DIR} && git checkout -- . 2>&1`, { timeout: 30000 });
          const pullOutput = execSync(`cd ${INSTALL_DIR} && git pull origin ${branch} 2>&1`, { timeout: 120000 }).toString().trim();
          
          if (pullOutput.includes('Already up to date') || pullOutput.includes('Already up-to-date')) {
            sendEvent(2, 'done', 'Já está na versão mais recente', pullOutput);
            // Restaurar configs
            execSync(`cd ${INSTALL_DIR} && cp -f .env.bak .env 2>/dev/null || true && cp -f auth-server/server.js.bak auth-server/server.js 2>/dev/null || true`, { timeout: 10000 });
            sendEvent(6, 'done', 'Sistema já está atualizado.');
            res.write(`data: ${JSON.stringify({ step: 'complete', status: 'up_to_date', message: 'Sistema já está na versão mais recente.' })}\n\n`);
            return res.end();
          }
          sendEvent(2, 'done', 'Código atualizado', pullOutput.substring(0, 200));
        } catch (e) {
          const output = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
          sendEvent(2, 'error', 'Erro no git pull', output);
          res.write(`data: ${JSON.stringify({ step: 'complete', status: 'error', message: 'Falha ao baixar atualizações', output })}\n\n`);
          return res.end();
        }

        // Etapa 3: Restaurar configs
        sendEvent(3, 'running', 'Restaurando configurações locais...');
        try {
          execSync(`cd ${INSTALL_DIR} && cp -f .env.bak .env 2>/dev/null || true && cp -f auth-server/server.js.bak auth-server/server.js 2>/dev/null || true`, { timeout: 10000 });
          sendEvent(3, 'done', 'Configurações restauradas');
        } catch (e) {
          sendEvent(3, 'warn', 'Restauração parcial', e.message);
        }

        // Etapa 4: npm install
        sendEvent(4, 'running', 'Instalando dependências (pode levar alguns minutos)...');
        try {
          const npmOutput = execSync(`cd ${INSTALL_DIR} && npm install --legacy-peer-deps 2>&1`, { timeout: 300000 }).toString().trim();
          const added = npmOutput.match(/added \d+ packages/);
          sendEvent(4, 'done', 'Dependências instaladas', added ? added[0] : '');
        } catch (e) {
          const output = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
          sendEvent(4, 'error', 'Erro ao instalar dependências', output.substring(0, 500));
          res.write(`data: ${JSON.stringify({ step: 'complete', status: 'error', message: 'Falha no npm install', output })}\n\n`);
          return res.end();
        }

        // Etapa 5: Build
        sendEvent(5, 'running', 'Compilando frontend (pode levar alguns minutos)...');
        try {
          const buildOutput = execSync(`cd ${INSTALL_DIR} && npm run build 2>&1`, { timeout: 300000 }).toString().trim();
          sendEvent(5, 'done', 'Frontend compilado com sucesso');
        } catch (e) {
          const output = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
          sendEvent(5, 'error', 'Erro ao compilar', output.substring(0, 500));
          res.write(`data: ${JSON.stringify({ step: 'complete', status: 'error', message: 'Falha no build', output })}\n\n`);
          return res.end();
        }

        // Etapa 6: Reiniciar serviços
        sendEvent(6, 'running', 'Reiniciando serviços...');
        try {
          execSync(`sudo systemctl restart nexus-auth nginx 2>&1`, { timeout: 30000 });
          sendEvent(6, 'done', 'Serviços reiniciados');
        } catch (e) {
          sendEvent(6, 'warn', 'Serviços podem precisar de reinício manual', e.message);
        }

        res.write(`data: ${JSON.stringify({ step: 'complete', status: 'updated', message: 'Sistema atualizado com sucesso! Recarregue a página.' })}\n\n`);
        res.end();

      } catch (error) {
        sendEvent(0, 'error', 'Erro inesperado', error.message);
        res.write(`data: ${JSON.stringify({ step: 'complete', status: 'error', message: error.message })}\n\n`);
        res.end();
      }
    }

    // GET /api/system/version
    if (path === '/api/system/version' && req.method === 'GET') {
      const { execFileSync } = require('child_process');

      const candidates = [
        process.env.INSTALL_DIR,
        '/opt/nexus-monitoramento',
        process.cwd(),
      ].filter(Boolean);

      const attempts = [];

      for (const dir of candidates) {
        try {
          const commitHash = execFileSync('git', ['-C', dir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
          const commitDate = execFileSync('git', ['-C', dir, 'log', '-1', '--format=%ci'], { encoding: 'utf8' }).trim();
          const branch = execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();

          if (commitHash) {
            return sendJSON(res, 200, {
              version: commitHash,
              date: commitDate,
              branch,
              source_dir: dir,
            });
          }
        } catch (e) {
          attempts.push({
            dir,
            error: e?.message || 'git command failed',
            stderr: e?.stderr ? String(e.stderr).trim() : '',
          });
        }
      }

      return sendJSON(res, 200, {
        version: 'unknown',
        date: '',
        branch: '',
        debug: {
          install_dir_env: process.env.INSTALL_DIR || null,
          cwd: process.cwd(),
          attempts,
        },
      });
    }

    // ---- SSL INSTALL (SSE streaming) ----
    if (path === '/api/system/ssl' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' });

      const body = await readBody(req);
      const sslDomain = (body.domain || '').trim().replace(/[^a-zA-Z0-9.\-]/g, '');
      const sslEmail = (body.email || `admin@${sslDomain}`).trim();

      if (!sslDomain || sslDomain.length < 4) {
        return sendJSON(res, 400, { error: 'Domínio inválido' });
      }

      // SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': CORS_HEADERS,
        'Access-Control-Allow-Methods': CORS_METHODS
      });

      const sendEvent = (step, status, message, detail) => {
        const data = JSON.stringify({ step, status, message, detail: detail || '' });
        res.write(`data: ${data}\n\n`);
      };

      try {
        // Step 1: Install certbot
        sendEvent(1, 'running', 'Instalando Certbot...');
        try {
          execSync('apt-get update -qq && apt-get install -y -qq certbot python3-certbot-nginx 2>&1', { timeout: 120000 });
          sendEvent(1, 'done', 'Certbot instalado');
        } catch (e) {
          const output = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
          if (output.includes('already the newest version') || output.includes('is already installed')) {
            sendEvent(1, 'done', 'Certbot já instalado');
          } else {
            sendEvent(1, 'error', 'Erro ao instalar Certbot', output.substring(0, 500));
            res.write(`data: ${JSON.stringify({ step: 'complete', status: 'error', message: 'Falha ao instalar Certbot', output })}\n\n`);
            return res.end();
          }
        }

        // Step 2: Configure Nginx for domain
        sendEvent(2, 'running', `Configurando Nginx para ${sslDomain}...`);
        try {
          const nginxConf = `server {
    listen 80;
    server_name ${sslDomain} www.${sslDomain};

    location / {
        root /opt/nexus-monitoramento/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /auth/ {
        proxy_pass http://127.0.0.1:8001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /rest/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
          fs.writeFileSync(`/etc/nginx/sites-available/${sslDomain}`, nginxConf);
          execSync(`ln -sf /etc/nginx/sites-available/${sslDomain} /etc/nginx/sites-enabled/`, { timeout: 5000 });
          execSync('nginx -t 2>&1', { timeout: 10000 });
          execSync('systemctl reload nginx 2>&1', { timeout: 10000 });
          sendEvent(2, 'done', 'Nginx configurado para o domínio');
        } catch (e) {
          const output = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
          sendEvent(2, 'error', 'Erro ao configurar Nginx', output.substring(0, 500));
          res.write(`data: ${JSON.stringify({ step: 'complete', status: 'error', message: 'Falha ao configurar Nginx', output })}\n\n`);
          return res.end();
        }

        // Step 3: Generate SSL certificate
        sendEvent(3, 'running', 'Gerando certificado SSL (Let\'s Encrypt)...');
        try {
          const certOutput = execSync(
            `certbot --nginx -d ${sslDomain} -d www.${sslDomain} --non-interactive --agree-tos --email ${sslEmail} 2>&1`,
            { timeout: 120000 }
          ).toString().trim();
          sendEvent(3, 'done', 'Certificado SSL gerado com sucesso');
        } catch (e) {
          const output = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
          // Check if certificate already exists
          if (output.includes('Certificate not yet due for renewal') || output.includes('already have a certificate')) {
            sendEvent(3, 'done', 'Certificado SSL já existe e está válido');
          } else {
            sendEvent(3, 'error', 'Erro ao gerar certificado SSL', output.substring(0, 500));
            res.write(`data: ${JSON.stringify({ step: 'complete', status: 'error', message: 'Falha ao gerar certificado. Verifique se o DNS aponta para este servidor.', output })}\n\n`);
            return res.end();
          }
        }

        // Step 4: Enable auto-renewal and restart
        sendEvent(4, 'running', 'Configurando renovação automática...');
        try {
          execSync('systemctl enable certbot.timer 2>&1 || true', { timeout: 10000 });
          execSync('systemctl reload nginx 2>&1', { timeout: 10000 });
          sendEvent(4, 'done', 'Renovação automática ativada');
        } catch (e) {
          sendEvent(4, 'warn', 'Renovação automática pode precisar de configuração manual', e.message);
        }

        res.write(`data: ${JSON.stringify({ step: 'complete', status: 'success', message: `SSL configurado com sucesso para ${sslDomain}! Acesse https://${sslDomain}` })}\n\n`);
        res.end();

      } catch (error) {
        sendEvent(0, 'error', 'Erro inesperado', error.message);
        res.write(`data: ${JSON.stringify({ step: 'complete', status: 'error', message: error.message })}\n\n`);
        res.end();
      }
    }

    // ---- AUTO-REGISTER: detecta IP local e cadastra servidor de mídia se não existir ----
    if (path === '/api/local/media-servers/auto-register' && req.method === 'POST') {
      try {
        // Detectar IP local
        const nets = os.networkInterfaces();
        let localIp = '127.0.0.1';
        for (const name of Object.keys(nets)) {
          for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
              localIp = net.address;
              break;
            }
          }
          if (localIp !== '127.0.0.1') break;
        }

        // Detectar OS
        const detectedOs = process.platform === 'win32' ? 'windows' : 'linux';

        // Verificar se já existe servidor cadastrado com esse IP
        const existing = await pool.query('SELECT * FROM media_servers WHERE ip_address = $1', [localIp]);
        let server;
        if (existing.rows.length > 0) {
          server = existing.rows[0];
        } else {
          // Cadastrar automaticamente
          const insertResult = await pool.query(
            `INSERT INTO media_servers (name, ip_address, instances, rtmp_base_port, hls_base_port, webrtc_base_port, status, os)
             VALUES ($1,$2,1,1935,8888,8889,'active',$3) RETURNING *`,
            ['Servidor Local', localIp, detectedOs]
          );
          server = insertResult.rows[0];
        }

        // Testar conexão MediaMTX (HLS e RTMP)
        let hlsOk = false, rtmpOk = false;
        try {
          const hlsTest = await new Promise((resolve) => {
            const req = http.get(`http://${localIp}:${server.hls_base_port}/v3/paths/list`, { timeout: 4000 }, (r) => resolve(r.statusCode < 500));
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
          });
          hlsOk = hlsTest;
        } catch(e) {}

        try {
          const net = require('net');
          rtmpOk = await new Promise((resolve) => {
            const sock = net.createConnection({ host: localIp, port: server.rtmp_base_port, timeout: 4000 });
            sock.on('connect', () => { sock.destroy(); resolve(true); });
            sock.on('error', () => resolve(false));
            sock.on('timeout', () => { sock.destroy(); resolve(false); });
          });
        } catch(e) {}

        const isOnline = hlsOk || rtmpOk;
        const newStatus = isOnline ? 'online' : 'offline';

        // Atualizar status
        await pool.query('UPDATE media_servers SET status=$1, updated_at=NOW() WHERE id=$2', [newStatus, server.id]);
        server.status = newStatus;

        return sendJSON(res, 200, { server, detected_ip: localIp, detected_os: detectedOs, online: isOnline, hls: hlsOk, rtmp: rtmpOk });
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }

    // ---- CRUD LOCAL: media_servers ----
    if (path === '/api/local/media-servers' && req.method === 'GET') {
      try {
        const result = await pool.query('SELECT * FROM media_servers ORDER BY created_at DESC');
        return sendJSON(res, 200, result.rows);
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }
    if (path === '/api/local/media-servers' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const result = await pool.query(
          `INSERT INTO media_servers (name, ip_address, instances, rtmp_base_port, hls_base_port, webrtc_base_port, status, os)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [body.name, body.ip_address, body.instances||1, body.rtmp_base_port||1935, body.hls_base_port||8888, body.webrtc_base_port||8889, body.status||'active', body.os||'linux']
        );
        return sendJSON(res, 201, result.rows[0]);
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }
    if (path.startsWith('/api/local/media-servers/') && req.method === 'PUT') {
      try {
        const id = path.split('/').pop();
        const body = await readBody(req);
        const result = await pool.query(
          `UPDATE media_servers SET name=$1, ip_address=$2, instances=$3, rtmp_base_port=$4, hls_base_port=$5, webrtc_base_port=$6, status=$7, os=$8, updated_at=NOW() WHERE id=$9 RETURNING *`,
          [body.name, body.ip_address, body.instances||1, body.rtmp_base_port||1935, body.hls_base_port||8888, body.webrtc_base_port||8889, body.status||'active', body.os||'linux', id]
        );
        return sendJSON(res, 200, result.rows[0]);
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }
    if (path.startsWith('/api/local/media-servers/') && req.method === 'PATCH') {
      try {
        const id = path.split('/').pop();
        const body = await readBody(req);
        const fields = Object.keys(body).filter(k => k !== 'id');
        if (fields.length === 0) return sendJSON(res, 400, { error: 'No fields' });
        const sets = fields.map((f, i) => `${f}=$${i+1}`).join(', ');
        const vals = fields.map(f => body[f]);
        vals.push(id);
        const result = await pool.query(`UPDATE media_servers SET ${sets}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
        return sendJSON(res, 200, result.rows[0]);
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }
    if (path.startsWith('/api/local/media-servers/') && req.method === 'DELETE') {
      try {
        const id = path.split('/').pop();
        await pool.query('DELETE FROM media_servers WHERE id=$1', [id]);
        return sendJSON(res, 200, { success: true });
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }

    // ---- CRUD LOCAL: storage_servers ----
    if (path === '/api/local/storage-servers' && req.method === 'GET') {
      try {
        const result = await pool.query('SELECT * FROM storage_servers ORDER BY created_at DESC');
        return sendJSON(res, 200, result.rows);
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }
    if (path === '/api/local/storage-servers' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const result = await pool.query(
          `INSERT INTO storage_servers (name, ip_address, storage_path, description, max_storage_gb, status)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [body.name, body.ip_address, body.storage_path||'', body.description||'', body.max_storage_gb||1000, body.status||'active']
        );
        return sendJSON(res, 201, result.rows[0]);
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }
    if (path.startsWith('/api/local/storage-servers/') && req.method === 'PUT') {
      try {
        const id = path.split('/').pop();
        const body = await readBody(req);
        const result = await pool.query(
          `UPDATE storage_servers SET name=$1, ip_address=$2, storage_path=$3, description=$4, max_storage_gb=$5, status=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
          [body.name, body.ip_address, body.storage_path||'', body.description||'', body.max_storage_gb||1000, body.status||'active', id]
        );
        return sendJSON(res, 200, result.rows[0]);
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }
    if (path.startsWith('/api/local/storage-servers/') && req.method === 'DELETE') {
      try {
        const id = path.split('/').pop();
        await pool.query('DELETE FROM storage_servers WHERE id=$1', [id]);
        return sendJSON(res, 200, { success: true });
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }

    // ---- CRUD LOCAL: manage-users ----
    if (path === '/api/local/manage-users' && req.method === 'GET') {
      // Verificar autenticação
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload?.sub) return sendJSON(res, 401, { error: 'Invalid token' });

      // Verificar se é admin
      const adminCheck = await pool.query(
        "SELECT role FROM user_roles WHERE user_id = $1 AND role = 'admin'", [payload.sub]
      );
      if (adminCheck.rows.length === 0) return sendJSON(res, 403, { error: 'Admin access required' });

      try {
        const usersResult = await pool.query('SELECT id, email, raw_user_meta_data, created_at FROM auth.users ORDER BY created_at DESC');
        const rolesResult = await pool.query('SELECT user_id, role FROM user_roles');

        const users = usersResult.rows.map(u => {
          const userRole = rolesResult.rows.find(r => r.user_id === u.id);
          const meta = u.raw_user_meta_data || {};
          return {
            id: u.id,
            email: u.email,
            name: meta.name || u.email.split('@')[0] || '',
            level: userRole ? userRole.role : 'n1',
            active: meta.active !== false,
            created_at: u.created_at,
          };
        });
        return sendJSON(res, 200, users);
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }

    if (path === '/api/local/manage-users' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload?.sub) return sendJSON(res, 401, { error: 'Invalid token' });

      const adminCheck = await pool.query(
        "SELECT role FROM user_roles WHERE user_id = $1 AND role = 'admin'", [payload.sub]
      );
      if (adminCheck.rows.length === 0) return sendJSON(res, 403, { error: 'Admin access required' });

      const body = await readBody(req);
      if (!body.action) return sendJSON(res, 400, { error: 'Action required' });

      try {
        if (body.action === 'create') {
          const { email, password, name, level } = body;
          if (!email || !password) return sendJSON(res, 400, { error: 'Email and password required' });
          if (password.length < 8) return sendJSON(res, 400, { error: 'Password must be at least 8 characters' });

          const validLevels = ['admin', 'n1', 'n2', 'n3'];
          const userLevel = validLevels.includes(level) ? level : 'n1';

          const result = await pool.query(
            `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
             VALUES ($1, crypt($2, gen_salt('bf')), NOW(), $3::jsonb) RETURNING id`,
            [email, password, JSON.stringify({ name: (name || '').slice(0, 100), force_password_change: true, active: true })]
          );
          const newUserId = result.rows[0].id;

          // Garantir uma única role para o usuário
          await pool.query('DELETE FROM user_roles WHERE user_id = $1', [newUserId]);
          await pool.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [newUserId, userLevel]);

          return sendJSON(res, 200, { success: true, user_id: newUserId });
        }

        if (body.action === 'update') {
          const { user_id, name, level, active } = body;
          if (!user_id) return sendJSON(res, 400, { error: 'User ID required' });

          if (user_id === payload.sub && level !== 'admin') {
            return sendJSON(res, 400, { error: 'Cannot demote yourself' });
          }

          // Atualizar metadata (schema local não possui banned_until)
          await pool.query(
            `UPDATE auth.users
             SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', $1::text, 'active', $2::boolean),
                 updated_at = NOW()
             WHERE id = $3`,
            [(name || '').slice(0, 100), active !== false, user_id]
          );

          // Atualizar role com modelo de role única
          const validLevels = ['admin', 'n1', 'n2', 'n3'];
          if (level && validLevels.includes(level)) {
            await pool.query('DELETE FROM user_roles WHERE user_id = $1', [user_id]);
            await pool.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [user_id, level]);
          }

          return sendJSON(res, 200, { success: true });
        }

        if (body.action === 'reset_password') {
          const { user_id } = body;
          if (!user_id) return sendJSON(res, 400, { error: 'User ID required' });

          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
          let tempPassword = 'A1!';
          for (let i = 0; i < 12; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

          await pool.query(
            `UPDATE auth.users SET encrypted_password = crypt($1, gen_salt('bf')),
             raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'), '{force_password_change}', 'true'),
             updated_at = NOW() WHERE id = $2`,
            [tempPassword, user_id]
          );

          return sendJSON(res, 200, { success: true, temporary_password: tempPassword });
        }

        if (body.action === 'delete') {
          const { user_id } = body;
          if (!user_id) return sendJSON(res, 400, { error: 'User ID required' });
          if (user_id === payload.sub) return sendJSON(res, 400, { error: 'Cannot delete yourself' });

          await pool.query('DELETE FROM user_roles WHERE user_id = $1', [user_id]);
          await pool.query('DELETE FROM auth.users WHERE id = $1', [user_id]);

          return sendJSON(res, 200, { success: true });
        }

        return sendJSON(res, 400, { error: 'Unknown action' });
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }

    // ---- UPDATE PASSWORD (local) ----
    if (path === '/api/local/update-password' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' });

      const body = await readBody(req);
      if (!body.password || body.password.length < 8) return sendJSON(res, 400, { error: 'Senha deve ter pelo menos 8 caracteres' });

      try {
        await pool.query(
          `UPDATE auth.users SET encrypted_password = crypt($1, gen_salt('bf')),
           raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'), '{force_password_change}', 'false'),
           updated_at = NOW() WHERE id = $2`,
          [body.password, payload.sub]
        );
        return sendJSON(res, 200, { success: true });
      } catch (e) { return sendJSON(res, 500, { error: e.message }); }
    }

    // ---- INSTALAR MediaMTX via SSE ----
    if (path === '/api/media-servers/install' && req.method === 'POST') {
      const body = await readBody(req);
      const osType = (body.os || 'linux').toLowerCase();
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': CORS_HEADERS,
      });

      const sendEvent = (step, status, message) => {
        res.write(`data: ${JSON.stringify({ step, status, message })}\n\n`);
      };

      try {
        if (osType === 'linux') {
          sendEvent('check', 'info', 'Verificando se MediaMTX já está instalado...');
          try {
            execSync('which mediamtx 2>/dev/null || test -f /usr/local/bin/mediamtx');
            sendEvent('check', 'success', 'MediaMTX já está instalado');
          } catch {
            sendEvent('download', 'info', 'Baixando MediaMTX...');
            try {
              const arch = execSync('dpkg --print-architecture 2>/dev/null || echo amd64').toString().trim();
              const mtxArch = arch === 'arm64' ? 'arm64v8' : 'amd64';
              execSync(`wget -q https://github.com/bluenviron/mediamtx/releases/download/v1.9.3/mediamtx_v1.9.3_linux_${mtxArch}.tar.gz -O /tmp/mediamtx.tar.gz`, { timeout: 120000 });
              sendEvent('download', 'success', 'Download concluído');
              
              sendEvent('extract', 'info', 'Extraindo e instalando...');
              execSync('cd /tmp && tar xzf mediamtx.tar.gz && sudo mv mediamtx /usr/local/bin/ && sudo chmod +x /usr/local/bin/mediamtx', { timeout: 30000 });
              sendEvent('extract', 'success', 'Binário instalado em /usr/local/bin/mediamtx');
            } catch (e) {
              sendEvent('download', 'error', 'Falha no download/instalação: ' + e.message);
              sendEvent('complete', 'error', 'Instalação falhou');
              return res.end();
            }
          }

          // Copiar config se existir
          sendEvent('config', 'info', 'Configurando MediaMTX...');
          try {
            const configSrc = '/opt/nexus-monitoramento/installer/mediamtx.yml';
            const configDst = '/usr/local/etc/mediamtx.yml';
            if (fs.existsSync(configSrc)) {
              execSync(`sudo cp ${configSrc} ${configDst}`);
              sendEvent('config', 'success', 'Configuração copiada');
            } else {
              // Se não há config customizada, usar a padrão gerada pelo tar
              if (fs.existsSync('/tmp/mediamtx.yml')) {
                execSync(`sudo mv /tmp/mediamtx.yml ${configDst}`);
              }
              sendEvent('config', 'info', 'Usando configuração padrão');
            }

            // Limpeza: remover campos obsoletos que causam falha na v1.9.3
            sendEvent('config', 'info', 'Removendo campos obsoletos do mediamtx.yml...');
            try {
              execSync(`sudo sed -i '/^rtspEncryption:/d' ${configDst}`, { timeout: 5000 });
              // Remover autenticação (acesso sem senha - projeto Bravo)
              execSync(`sudo sed -i 's/^readUser:.*/readUser: ""/' ${configDst}`, { timeout: 5000 });
              execSync(`sudo sed -i 's/^readPass:.*/readPass: ""/' ${configDst}`, { timeout: 5000 });
              execSync(`sudo sed -i 's/^publishUser:.*/publishUser: ""/' ${configDst}`, { timeout: 5000 });
              execSync(`sudo sed -i 's/^publishPass:.*/publishPass: ""/' ${configDst}`, { timeout: 5000 });
              sendEvent('config', 'success', 'Campos obsoletos removidos e autenticação desabilitada');
            } catch (e) {
              sendEvent('config', 'warn', 'Limpeza parcial do yml: ' + e.message);
            }
          } catch (e) {
            sendEvent('config', 'warn', 'Não foi possível copiar config: ' + e.message);
          }

          // Criar serviço systemd
          sendEvent('service', 'info', 'Criando serviço systemd...');
          try {
            const serviceContent = `[Unit]
Description=MediaMTX Media Server
After=network.target

[Service]
ExecStart=/usr/local/bin/mediamtx /usr/local/etc/mediamtx.yml
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
`;
            fs.writeFileSync('/tmp/mediamtx.service', serviceContent);
            execSync('sudo mv /tmp/mediamtx.service /etc/systemd/system/mediamtx.service && sudo systemctl daemon-reload && sudo systemctl enable mediamtx && sudo systemctl start mediamtx', { timeout: 15000 });
            sendEvent('service', 'success', 'Serviço MediaMTX criado e iniciado');

            // Liberar portas no firewall
            sendEvent('firewall', 'info', 'Liberando portas no firewall...');
            try {
              execSync('sudo ufw allow 1935/tcp comment "RTMP MediaMTX" && sudo ufw allow 8554/tcp comment "RTSP MediaMTX" && sudo ufw allow 8888/tcp comment "HLS MediaMTX" && sudo ufw allow 8889/tcp comment "WebRTC MediaMTX" && sudo ufw reload', { timeout: 15000 });
              sendEvent('firewall', 'success', 'Portas 1935, 8554, 8888, 8889 liberadas');
            } catch (e) {
              sendEvent('firewall', 'warn', 'Não foi possível liberar portas automaticamente: ' + e.message);
            }
          } catch (e) {
            sendEvent('service', 'error', 'Falha ao criar serviço: ' + e.message);
          }

          // Verificar se está rodando
          sendEvent('verify', 'info', 'Verificando se MediaMTX está rodando...');
          try {
            execSync('sleep 2 && systemctl is-active mediamtx', { timeout: 10000 });
            sendEvent('verify', 'success', 'MediaMTX está ativo e funcionando!');
            sendEvent('complete', 'success', 'Instalação concluída com sucesso!');
          } catch {
            sendEvent('verify', 'warn', 'MediaMTX pode não ter iniciado corretamente. Verifique com: sudo systemctl status mediamtx');
            sendEvent('complete', 'success', 'Instalação concluída (verificar serviço)');
          }

        } else if (osType === 'windows') {
          sendEvent('info', 'info', 'Para Windows, execute o instalador .exe no servidor de destino.');
          sendEvent('complete', 'success', 'No Windows, use o instalador dedicado.');
        } else {
          sendEvent('complete', 'error', 'Sistema operacional não suportado: ' + osType);
        }
      } catch (e) {
        sendEvent('complete', 'error', 'Erro inesperado: ' + e.message);
      }

      return res.end();
    }

    // ---- SNAPSHOT ENDPOINT (captura frame do HLS via ffmpeg) ----
    if (path === '/api/cameras/snapshot' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' });

      const { stream_key, snapshot_url } = await readBody(req);
      if (!stream_key && !snapshot_url) return sendJSON(res, 400, { error: 'stream_key or snapshot_url required' });

      const { execSync } = require('child_process');
      const fs = require('fs');
      const os = require('os');
      const pathMod = require('path');

      const tmpFile = pathMod.join(os.tmpdir(), `nexus-snap-${Date.now()}.jpg`);

      try {
        // Buscar IP do media server no banco
        let mediaIp = '127.0.0.1';
        let hlsPort = 8888;
        try {
          const msResult = await pool.query(`SELECT ip_address, hls_base_port FROM media_servers WHERE status = 'online' LIMIT 1`);
          if (msResult.rows.length > 0) {
            mediaIp = msResult.rows[0].ip_address || '127.0.0.1';
            hlsPort = msResult.rows[0].hls_base_port || 8888;
          }
        } catch {}

        // Usar apenas a URL HLS do stream cadastrado (MediaMTX)
        const sourceUrl = `http://${mediaIp}:${hlsPort}/${stream_key}/`;

        // Capturar frame via ffmpeg
        execSync(`ffmpeg -y -i "${sourceUrl}" -vframes 1 -q:v 2 -f image2 "${tmpFile}" 2>/dev/null`, { timeout: 15000 });

        if (!fs.existsSync(tmpFile)) {
          return sendJSON(res, 500, { error: 'Falha ao capturar frame do stream' });
        }

        const imageBase64 = fs.readFileSync(tmpFile).toString('base64');
        try { fs.unlinkSync(tmpFile); } catch {}

        return sendJSON(res, 200, { image_base64: imageBase64 });
      } catch (err) {
        try { require('fs').unlinkSync(tmpFile); } catch {}
        return sendJSON(res, 500, { error: 'Snapshot capture failed: ' + err.message });
      }
    }

    // ---- GRAVAÇÃO: Iniciar/Parar gravação via FFmpeg ----
    // Armazena processos de gravação ativos: { [cameraId]: { process, filePath, startTime, ... } }
    if (!global._activeRecordings) global._activeRecordings = {};

    if (path === '/api/cameras/recording/start' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' });

      const { camera_id, stream_key, camera_name, client_id, client_name, storage_path } = await readBody(req);
      if (!camera_id || !stream_key) return sendJSON(res, 400, { error: 'camera_id and stream_key required' });

      // Verificar se já está gravando
      if (global._activeRecordings[camera_id]) {
        return sendJSON(res, 409, { error: 'Gravação já em andamento para esta câmera' });
      }

      try {
        // Buscar IP do media server
        let mediaIp = '127.0.0.1';
        let hlsPort = 8888;
        try {
          const msResult = await pool.query(`SELECT ip_address, hls_base_port FROM media_servers WHERE status = 'online' LIMIT 1`);
          if (msResult.rows.length > 0) {
            mediaIp = msResult.rows[0].ip_address || '127.0.0.1';
            hlsPort = msResult.rows[0].hls_base_port || 8888;
          }
        } catch {}

        const sourceUrl = `http://${mediaIp}:${hlsPort}/${stream_key}/`;

        // Definir pasta de destino
        const baseDir = storage_path || '/opt/nexus-monitoramento/recordings';
        const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const recDir = pathMod.join(baseDir, camera_id, dateStr);
        if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${stream_key}_${timestamp}.mp4`;
        const filePath = pathMod.join(recDir, fileName);

        const startTime = new Date();

        // Iniciar FFmpeg em background
        const { spawn } = require('child_process');
        const ffmpegArgs = [
          '-y',
          '-i', sourceUrl,
          '-c', 'copy',        // Sem re-encoding (rápido)
          '-movflags', '+frag_keyframe+empty_moov+faststart',
          '-f', 'mp4',
          filePath
        ];

        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
          detached: false,
          stdio: ['ignore', 'ignore', 'ignore'],
        });

        ffmpegProcess.on('error', (err) => {
          console.error(`FFmpeg recording error for ${camera_name}:`, err);
          delete global._activeRecordings[camera_id];
        });

        ffmpegProcess.on('exit', (code) => {
          console.log(`FFmpeg recording ended for ${camera_name} (code ${code})`);
          // Se saiu sem ser pelo stop, limpar
          if (global._activeRecordings[camera_id]) {
            delete global._activeRecordings[camera_id];
          }
        });

        global._activeRecordings[camera_id] = {
          process: ffmpegProcess,
          filePath,
          startTime,
          cameraName: camera_name,
          clientId: client_id,
          clientName: client_name,
        };

        return sendJSON(res, 200, {
          status: 'recording',
          camera_id,
          file_path: filePath,
          start_time: startTime.toISOString(),
        });
      } catch (err) {
        return sendJSON(res, 500, { error: 'Falha ao iniciar gravação: ' + err.message });
      }
    }

    if (path === '/api/cameras/recording/stop' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' });

      const { camera_id } = await readBody(req);
      if (!camera_id) return sendJSON(res, 400, { error: 'camera_id required' });

      const rec = global._activeRecordings[camera_id];
      if (!rec) {
        return sendJSON(res, 404, { error: 'Nenhuma gravação ativa para esta câmera' });
      }

      try {
        // Enviar SIGINT para FFmpeg (encerra graciosamente)
        rec.process.kill('SIGINT');

        const endTime = new Date();
        const durationSeconds = Math.round((endTime.getTime() - rec.startTime.getTime()) / 1000);

        // Calcular tamanho do arquivo
        let fileSizeMb = 0;
        try {
          await new Promise(r => setTimeout(r, 1000)); // Esperar FFmpeg finalizar
          if (fs.existsSync(rec.filePath)) {
            const stats = fs.statSync(rec.filePath);
            fileSizeMb = Math.round(stats.size / (1024 * 1024) * 10) / 10;
          }
        } catch {}

        // Registrar gravação no banco
        try {
          await pool.query(
            `INSERT INTO recordings (camera_id, camera_name, client_id, client_name, start_time, end_time, duration_seconds, file_size_mb, file_path, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed')`,
            [camera_id, rec.cameraName, rec.clientId, rec.clientName, rec.startTime.toISOString(), endTime.toISOString(), durationSeconds, fileSizeMb, rec.filePath]
          );
        } catch (dbErr) {
          console.error('Erro ao salvar gravação no banco:', dbErr);
        }

        delete global._activeRecordings[camera_id];

        return sendJSON(res, 200, {
          status: 'stopped',
          camera_id,
          file_path: rec.filePath,
          duration_seconds: durationSeconds,
          file_size_mb: fileSizeMb,
        });
      } catch (err) {
        delete global._activeRecordings[camera_id];
        return sendJSON(res, 500, { error: 'Falha ao parar gravação: ' + err.message });
      }
    }

    if (path === '/api/cameras/recording/status' && req.method === 'GET') {
      const active = Object.entries(global._activeRecordings || {}).map(([id, rec]) => ({
        camera_id: id,
        camera_name: (rec as any).cameraName,
        start_time: (rec as any).startTime.toISOString(),
        file_path: (rec as any).filePath,
        duration_seconds: Math.round((Date.now() - (rec as any).startTime.getTime()) / 1000),
      }));
      return sendJSON(res, 200, { active_recordings: active });
    }

    // ---- AUTO-ANALYZE CONTÍNUO: Controle ----
    if (path === '/api/analytics/start' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' });

      const body = await readBody(req);
      const interval = body.interval || 3; // seconds
      startContinuousAnalysis(token, interval);
      return sendJSON(res, 200, { status: 'started', interval });
    }

    if (path === '/api/analytics/stop' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' });

      stopContinuousAnalysis();
      return sendJSON(res, 200, { status: 'stopped' });
    }

    if (path === '/api/analytics/status' && req.method === 'GET') {
      return sendJSON(res, 200, getAnalysisStatus());
    }

    // ---- TESTE DE SERVIDOR DE MÍDIA ----
    if (path === '/api/media-servers/test' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' });

      const { ip_address, hls_base_port, rtmp_base_port, os: serverOs } = await readBody(req);
      if (!ip_address) return sendJSON(res, 400, { error: 'ip_address required' });

      const results = { ip_address, rtmp: false, rtsp: false, hls: false, mediamtx_running: false, os: serverOs || 'unknown' };

      // Testar conectividade HLS (HTTP)
      try {
        const hlsPort = hls_base_port || 8888;
        const testUrl = `http://${ip_address}:${hlsPort}/v3/paths/list`;
        const httpLib = require('http');
        await new Promise((resolve, reject) => {
          const r = httpLib.get(testUrl, { timeout: 5000 }, (resp) => {
            let data = '';
            resp.on('data', c => data += c);
            resp.on('end', () => {
              results.hls = resp.statusCode === 200;
              results.mediamtx_running = resp.statusCode === 200;
              try { results.paths = JSON.parse(data); } catch {}
              resolve();
            });
          });
          r.on('error', () => { results.hls = false; resolve(); });
          r.on('timeout', () => { r.destroy(); results.hls = false; resolve(); });
        });
      } catch {}

      // Testar porta RTMP via socket
      try {
        const net = require('net');
        const rtmpPort = rtmp_base_port || 1935;
        await new Promise((resolve) => {
          const sock = new net.Socket();
          sock.setTimeout(3000);
          sock.on('connect', () => { results.rtmp = true; sock.destroy(); resolve(); });
          sock.on('error', () => { results.rtmp = false; resolve(); });
          sock.on('timeout', () => { sock.destroy(); results.rtmp = false; resolve(); });
          sock.connect(rtmpPort, ip_address);
        });
      } catch {}

      // Testar porta RTSP via socket (8554)
      try {
        const net = require('net');
        const rtspPort = 8554;
        await new Promise((resolve) => {
          const sock = new net.Socket();
          sock.setTimeout(3000);
          sock.on('connect', () => { results.rtsp = true; sock.destroy(); resolve(); });
          sock.on('error', () => { results.rtsp = false; resolve(); });
          sock.on('timeout', () => { sock.destroy(); results.rtsp = false; resolve(); });
          sock.connect(rtspPort, ip_address);
        });
      } catch {}

      results.online = results.mediamtx_running || results.rtmp || results.rtsp;
      return sendJSON(res, 200, results);
    }

    // ---- SYSTEM INFO: Detectar SO e sugerir path de gravação ----
    if (path === '/api/system-info' && req.method === 'GET') {
      const platform = os.platform(); // 'win32', 'linux', 'darwin'
      const hostname = os.hostname();
      const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024));
      
      // Detectar IP local
      const nets = os.networkInterfaces();
      let localIp = '127.0.0.1';
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            localIp = net.address;
            break;
          }
        }
        if (localIp !== '127.0.0.1') break;
      }
      
      // Sugerir path de gravação baseado no SO
      let suggestedPath = '';
      let osName = '';
      if (platform === 'win32') {
        osName = 'Windows';
        suggestedPath = 'D:\\Gravacoes';
        // Verificar se D: existe, senão usar C:
        try {
          if (!fs.existsSync('D:\\')) {
            suggestedPath = 'C:\\Gravacoes';
          }
        } catch (e) {
          suggestedPath = 'C:\\Gravacoes';
        }
      } else {
        osName = 'Linux';
        suggestedPath = '/opt/nexus-monitoramento/gravacoes';
      }
      
      // Calcular espaço em disco disponível
      let diskFreeGb = 0;
      try {
        if (platform === 'win32') {
          const drive = suggestedPath.charAt(0);
          const out = execSync(`wmic logicaldisk where "DeviceID='${drive}:'" get FreeSpace /format:value`, { encoding: 'utf8' });
          const match = out.match(/FreeSpace=(\d+)/);
          if (match) diskFreeGb = Math.round(parseInt(match[1]) / (1024 * 1024 * 1024));
        } else {
          const out = execSync(`df -BG --output=avail / | tail -1`, { encoding: 'utf8' });
          diskFreeGb = parseInt(out.trim()) || 0;
        }
      } catch (e) {
        diskFreeGb = 0;
      }
      
      return sendJSON(res, 200, {
        platform,
        os_name: osName,
        hostname,
        local_ip: localIp,
        suggested_path: suggestedPath,
        disk_free_gb: diskFreeGb,
        total_memory_gb: totalMem,
      });
    }

    // ---- CREATE STORAGE PATH: Criar pasta de gravação no servidor ----
    if (path === '/api/storage/create-path' && req.method === 'POST') {
      const body = await readBody(req);
      const { storage_path } = body;
      if (!storage_path || typeof storage_path !== 'string') {
        return sendJSON(res, 400, { error: 'Caminho inválido' });
      }
      // Sanitize: block traversal
      if (storage_path.includes('..')) {
        return sendJSON(res, 400, { error: 'Caminho inválido' });
      }
      try {
        fs.mkdirSync(storage_path, { recursive: true });
        return sendJSON(res, 200, { created: true, path: storage_path });
      } catch (e) {
        return sendJSON(res, 500, { error: 'Não foi possível criar o diretório: ' + e.message });
      }
    }

    // ---- SNAPSHOT MANUAL (manter para uso pontual) ----
    // Keep existing auto-analyze endpoint for manual trigger
    if (path === '/api/cameras/auto-analyze' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' });

      // Trigger one cycle manually
      const result = await runAnalysisCycle(token);
      return sendJSON(res, 200, result);
    }

    // ---- REST API (proxy para PostgREST) ----
    if (path.startsWith('/rest/v1/')) {
      const postgrestPath = path.replace('/rest/v1/', '/');
      return proxyToPostgREST(req, res, postgrestPath);
    }

    // Fallback: proxy direto
    if (path.startsWith('/')) {
      return proxyToPostgREST(req, res, path);
    }

    sendJSON(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('Error:', err.message);
    sendJSON(res, 500, { error: err.message });
  }
});

// ============================================================
//  WORKER DE ANÁLISE CONTÍNUA EM TEMPO REAL
//  Captura frames do HLS e envia para IA a cada N segundos
// ============================================================

const analysisState = {
  running: false,
  interval: 3, // seconds between cycles
  concurrency: 5, // parallel camera analyses
  token: null,
  stats: {
    startedAt: null,
    cyclesCompleted: 0,
    totalDetections: 0,
    totalErrors: 0,
    camerasAnalyzed: 0,
    lastCycleAt: null,
    lastCycleDuration: 0,
    rateLimited: false,
    rateLimitedUntil: null,
  },
};

function getSupabaseConfig() {
  let supabaseUrl = '';
  let supabaseAnonKey = '';
  try {
    const envPath = pathMod.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
      const keyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
      if (urlMatch) supabaseUrl = urlMatch[1].trim();
      if (keyMatch) supabaseAnonKey = keyMatch[1].trim();
    }
  } catch {}
  return { supabaseUrl, supabaseAnonKey };
}

async function getMediaServer() {
  let mediaIp = '127.0.0.1';
  let hlsPort = 8888;
  try {
    const msResult = await pool.query(`SELECT ip_address, hls_base_port FROM media_servers WHERE status = 'online' LIMIT 1`);
    if (msResult.rows.length > 0) {
      mediaIp = msResult.rows[0].ip_address || '127.0.0.1';
      hlsPort = msResult.rows[0].hls_base_port || 8888;
    }
  } catch {}
  return { mediaIp, hlsPort };
}

function captureFrame(sourceUrl, tmpFile) {
  try {
    execSync(`ffmpeg -y -i "${sourceUrl}" -vframes 1 -q:v 2 -f image2 "${tmpFile}" 2>/dev/null`, { timeout: 10000 });
    if (fs.existsSync(tmpFile)) {
      const base64 = fs.readFileSync(tmpFile).toString('base64');
      try { fs.unlinkSync(tmpFile); } catch {}
      return base64;
    }
  } catch {}
  try { fs.unlinkSync(tmpFile); } catch {}
  return null;
}

function sendToAI(supabaseUrl, supabaseAnonKey, token, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const url = new URL(`${supabaseUrl}/functions/v1/analyze-camera`);
    const httpModule = url.protocol === 'https:' ? require('https') : require('http');
    const reqOpts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseAnonKey,
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const r = httpModule.request(reqOpts, (response) => {
      let body = '';
      response.on('data', (chunk) => body += chunk);
      response.on('end', () => {
        if (response.statusCode === 429) {
          resolve({ error: 'rate_limited', status: 429 });
        } else if (response.statusCode === 402) {
          resolve({ error: 'credits_exhausted', status: 402 });
        } else {
          try { resolve(JSON.parse(body)); } catch { resolve({ error: body }); }
        }
      });
    });
    r.on('error', reject);
    r.setTimeout(30000, () => { r.destroy(); reject(new Error('Timeout')); });
    r.write(postData);
    r.end();
  });
}

async function analyzeCamera(cam, mediaIp, hlsPort, supabaseUrl, supabaseAnonKey, token) {
  const sourceUrl = `http://${mediaIp}:${hlsPort}/${cam.stream_key}/`;
  const tmpFile = pathMod.join(os.tmpdir(), `nexus-rt-${cam.id}-${Date.now()}.jpg`);

  const base64 = captureFrame(sourceUrl, tmpFile);
  if (!base64) return { camera: cam.name, status: 'skip', reason: 'stream_offline' };

  try {
    const result = await sendToAI(supabaseUrl, supabaseAnonKey, token, {
      image_base64: base64,
      camera_id: cam.id,
      camera_name: cam.name,
      client_id: cam.client_id || null,
      client_name: cam.client_name || null,
      enabled_analytics: cam.analytics || [],
    });

    if (result.error === 'rate_limited') {
      analysisState.stats.rateLimited = true;
      analysisState.stats.rateLimitedUntil = Date.now() + 60000;
      return { camera: cam.name, status: 'rate_limited' };
    }
    if (result.error === 'credits_exhausted') {
      console.error('AI credits exhausted - stopping continuous analysis');
      stopContinuousAnalysis();
      return { camera: cam.name, status: 'credits_exhausted' };
    }

    if (result.detections_count > 0) {
      analysisState.stats.totalDetections += result.detections_count;
      console.log(`🚨 ${cam.name}: ${result.detections_count} detecção(ões) - ${result.detections.map(d => d.event_type).join(', ')}`);
    }

    return { camera: cam.name, status: 'ok', detections: result.detections_count || 0 };
  } catch (err) {
    analysisState.stats.totalErrors++;
    return { camera: cam.name, status: 'error', error: err.message };
  }
}

async function runAnalysisCycle(token) {
  const cycleStart = Date.now();
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: 'Supabase não configurado no .env' };
  }

  const { mediaIp, hlsPort } = await getMediaServer();

  const camResult = await pool.query(`
    SELECT c.id, c.name, c.stream_key, c.analytics, c.client_id, cl.name as client_name
    FROM cameras c
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE c.status = 'online'
      AND c.analytics IS NOT NULL
      AND array_length(c.analytics, 1) > 0
  `);

  if (camResult.rows.length === 0) {
    return { analyzed: 0, message: 'Nenhuma camera com analiticos' };
  }

  const cameras = camResult.rows;
  const results = [];
  const concurrency = analysisState.concurrency;

  // Processar em lotes paralelos
  for (let i = 0; i < cameras.length; i += concurrency) {
    // Check rate limit cooldown
    if (analysisState.stats.rateLimited && analysisState.stats.rateLimitedUntil > Date.now()) {
      const waitMs = analysisState.stats.rateLimitedUntil - Date.now();
      console.log(`⏳ Rate limited, aguardando ${Math.ceil(waitMs/1000)}s...`);
      await new Promise(r => setTimeout(r, waitMs));
      analysisState.stats.rateLimited = false;
    }

    const batch = cameras.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(cam => analyzeCamera(cam, mediaIp, hlsPort, supabaseUrl, supabaseAnonKey, token))
    );
    results.push(...batchResults);
  }

  const cycleDuration = Date.now() - cycleStart;
  analysisState.stats.cyclesCompleted++;
  analysisState.stats.camerasAnalyzed = cameras.length;
  analysisState.stats.lastCycleAt = new Date().toISOString();
  analysisState.stats.lastCycleDuration = cycleDuration;

  return {
    analyzed: results.filter(r => r.status === 'ok').length,
    total: cameras.length,
    duration_ms: cycleDuration,
    results,
  };
}

let analysisLoop = null;

// Gerar token de serviço interno para o worker (não precisa de login)
function createServiceToken() {
  const now = Math.floor(Date.now() / 1000);
  return createJWT({
    sub: 'system-analytics-worker',
    role: 'service_role',
    iat: now,
    exp: now + 86400 * 365, // 1 year
  });
}

function startContinuousAnalysis(token, interval) {
  if (analysisState.running) {
    console.log('⚠️ Análise contínua já está rodando');
    return;
  }

  analysisState.running = true;
  analysisState.interval = interval || 3;
  analysisState.token = token;
  analysisState.stats.startedAt = new Date().toISOString();
  analysisState.stats.cyclesCompleted = 0;
  analysisState.stats.totalDetections = 0;
  analysisState.stats.totalErrors = 0;

  console.log(`🟢 Análise contínua INICIADA - intervalo: ${analysisState.interval}s`);

  const loop = async () => {
    while (analysisState.running) {
      try {
        await runAnalysisCycle(analysisState.token);
      } catch (err) {
        console.error('Cycle error:', err.message);
        analysisState.stats.totalErrors++;
      }

      // Aguardar o intervalo antes do próximo ciclo
      if (analysisState.running) {
        await new Promise(r => setTimeout(r, analysisState.interval * 1000));
      }
    }
  };

  analysisLoop = loop();
}

function stopContinuousAnalysis() {
  if (!analysisState.running) return;
  analysisState.running = false;
  analysisState.token = null;
  console.log('🔴 Análise contínua PARADA');
}

function getAnalysisStatus() {
  return {
    running: analysisState.running,
    interval: analysisState.interval,
    concurrency: analysisState.concurrency,
    ...analysisState.stats,
  };
}

// Auto-start: iniciar análise contínua automaticamente ao boot
async function autoStartAnalysis() {
  // Aguardar 10s para garantir que o banco e MediaMTX estejam prontos
  await new Promise(r => setTimeout(r, 10000));

  try {
    // Verificar se há câmeras com analíticos
    const camResult = await pool.query(`
      SELECT COUNT(*) as count FROM cameras
      WHERE status = 'online'
        AND analytics IS NOT NULL
        AND array_length(analytics, 1) > 0
    `);

    const camCount = parseInt(camResult.rows[0]?.count || '0');
    if (camCount === 0) {
      console.log('ℹ️ Nenhuma câmera com analíticos habilitados. Worker aguardando...');
      // Verificar novamente a cada 60 segundos
      setTimeout(autoStartAnalysis, 60000);
      return;
    }

    // Verificar se .env tem as credenciais Supabase
    const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
    if (!supabaseUrl || !supabaseAnonKey) {
      console.log('⚠️ Supabase não configurado no .env - análise automática desabilitada');
      return;
    }

    // Gerar token de serviço e iniciar
    const serviceToken = createServiceToken();
    console.log(`🤖 Auto-start: ${camCount} câmeras com analíticos encontradas`);
    startContinuousAnalysis(serviceToken, 3);
  } catch (err) {
    console.error('Auto-start error:', err.message);
    // Tentar novamente em 30s
    setTimeout(autoStartAnalysis, 30000);
  }
}

// Sincronizar media_servers locais para Supabase Cloud
async function syncMediaServersToCloud() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: 'Supabase não configurado no .env', synced: 0 };
  }
  try {
    const localServers = await pool.query('SELECT * FROM media_servers ORDER BY created_at');
    if (localServers.rows.length === 0) {
      return { synced: 0, message: 'Nenhum servidor local encontrado' };
    }

    const serviceToken = createServiceToken();
    let synced = 0;

    for (const srv of localServers.rows) {
      // Upsert by name+ip to avoid duplicates
      const checkRes = await fetch(`${supabaseUrl}/rest/v1/media_servers?name=eq.${encodeURIComponent(srv.name)}&ip_address=eq.${encodeURIComponent(srv.ip_address)}`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Accept': 'application/json',
        },
      });
      const existing = await checkRes.json();

      if (existing.length === 0) {
        // Insert
        const insertRes = await fetch(`${supabaseUrl}/rest/v1/media_servers`, {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            name: srv.name,
            ip_address: srv.ip_address,
            instances: srv.instances,
            rtmp_base_port: srv.rtmp_base_port,
            hls_base_port: srv.hls_base_port,
            webrtc_base_port: srv.webrtc_base_port,
            status: srv.status,
          }),
        });
        if (insertRes.ok) synced++;
        else console.log('Sync insert error:', await insertRes.text());
      } else {
        // Update
        await fetch(`${supabaseUrl}/rest/v1/media_servers?id=eq.${existing[0].id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            instances: srv.instances,
            rtmp_base_port: srv.rtmp_base_port,
            hls_base_port: srv.hls_base_port,
            webrtc_base_port: srv.webrtc_base_port,
            status: srv.status,
          }),
        });
        synced++;
      }
    }

    console.log(`✅ Sync: ${synced} servidor(es) sincronizados com a nuvem`);
    return { synced, total: localServers.rows.length };
  } catch (err) {
    console.error('Sync error:', err.message);
    return { error: err.message, synced: 0 };
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Nexus Auth + API Gateway rodando em http://localhost:${PORT}`);
  console.log(`PostgREST em ${POSTGREST_URL}`);
  // Cada servidor é independente — sem sync para nuvem
  // Iniciar análise contínua automaticamente
  autoStartAnalysis();
});
