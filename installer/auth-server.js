/**
 * Nexus Monitoramento - Auth Server
 * Servidor de autenticação compatível com Supabase JS Client
 * Roda junto com PostgREST para fornecer auth + REST API
 */

const http = require('http');
const { Pool } = require('pg');
const crypto = require('crypto');

// Configuração
const PORT = 8001;
const JWT_SECRET = 'nexus-monitoramento-jwt-secret-key-2024-super-seguro';
const POSTGREST_URL = 'http://127.0.0.1:3000';
const CORS_HEADERS = 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';
const CORS_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'nexus',
  user: 'postgres',
  password: '' // Definido pelo instalador
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
    if (path === '/api/system/update' && req.method === 'POST') {
      // Verificar autenticacao
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' });

      const { execSync } = require('child_process');
      const INSTALL_DIR = process.env.INSTALL_DIR || '/opt/nexus-monitoramento';

      try {
        const scriptPath = `${INSTALL_DIR}/atualizar-nexus.sh`;
        const output = execSync(`bash ${scriptPath} 2>&1`, { timeout: 600000 }).toString();

        if (output.includes('Already up to date') || output.includes('ja esta na versao')) {
          return sendJSON(res, 200, { 
            status: 'up_to_date', 
            message: 'Sistema ja esta na versao mais recente.',
            output: output.trim()
          });
        }

        return sendJSON(res, 200, { 
          status: 'updated', 
          message: 'Sistema atualizado com sucesso! Recarregue a pagina.',
          output: output.trim()
        });
      } catch (error) {
        const stdout = error.stdout ? error.stdout.toString() : '';
        // Se o script rodou mas retornou algo util, pode ser sucesso
        if (stdout.includes('atualizado') || stdout.includes('sucesso')) {
          return sendJSON(res, 200, {
            status: 'updated',
            message: 'Sistema atualizado com sucesso! Recarregue a pagina.',
            output: stdout.trim()
          });
        }
        return sendJSON(res, 500, { 
          status: 'error', 
          message: 'Erro ao atualizar: ' + error.message,
          output: stdout
        });
      }
    }

    // GET /api/system/version
    if (path === '/api/system/version' && req.method === 'GET') {
      const { execSync } = require('child_process');
      const INSTALL_DIR = process.env.INSTALL_DIR || '/opt/nexus-monitoramento';
      
      try {
        const commitHash = execSync(`cd ${INSTALL_DIR} && git rev-parse --short HEAD 2>/dev/null`).toString().trim();
        const commitDate = execSync(`cd ${INSTALL_DIR} && git log -1 --format="%ci" 2>/dev/null`).toString().trim();
        const branch = execSync(`cd ${INSTALL_DIR} && git rev-parse --abbrev-ref HEAD 2>/dev/null`).toString().trim();
        
        return sendJSON(res, 200, {
          version: commitHash,
          date: commitDate,
          branch: branch
        });
      } catch {
        return sendJSON(res, 200, { version: 'unknown', date: '', branch: '' });
      }
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

    // ---- AUTO-ANALYZE LOCAL (analisa todas as cameras via HLS) ----
    if (path === '/api/cameras/auto-analyze' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendJSON(res, 401, { error: 'Not authenticated' });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) return sendJSON(res, 401, { error: 'Invalid token' });

      const { execSync } = require('child_process');
      const fs = require('fs');
      const os = require('os');
      const pathMod = require('path');
      const https = require('https');

      try {
        // Buscar cameras com analytics habilitados
        const camResult = await pool.query(`
          SELECT c.id, c.name, c.stream_key, c.stream_url, c.analytics, c.snapshot_url,
                 c.client_id, cl.name as client_name
          FROM cameras c
          LEFT JOIN clients cl ON c.client_id = cl.id
          WHERE c.status = 'online'
            AND c.analytics IS NOT NULL
            AND array_length(c.analytics, 1) > 0
        `);

        if (camResult.rows.length === 0) {
          return sendJSON(res, 200, { analyzed: 0, message: 'Nenhuma camera com analiticos' });
        }

        // Buscar media server
        let mediaIp = '127.0.0.1';
        let hlsPort = 8888;
        try {
          const msResult = await pool.query(`SELECT ip_address, hls_base_port FROM media_servers WHERE status = 'online' LIMIT 1`);
          if (msResult.rows.length > 0) {
            mediaIp = msResult.rows[0].ip_address || '127.0.0.1';
            hlsPort = msResult.rows[0].hls_base_port || 8888;
          }
        } catch {}

        // Ler SUPABASE_URL e ANON_KEY do .env se disponível
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

        const results = [];

        for (const cam of camResult.rows) {
          const tmpFile = pathMod.join(os.tmpdir(), `nexus-analyze-${cam.id}.jpg`);
          try {
            // Capturar frame apenas da URL HLS do stream cadastrado (MediaMTX)
            const sourceUrl = `http://${mediaIp}:${hlsPort}/${cam.stream_key}/`;
            let captured = false;

            try {
              execSync(`ffmpeg -y -i "${sourceUrl}" -vframes 1 -q:v 2 -f image2 "${tmpFile}" 2>/dev/null`, { timeout: 15000 });
              if (fs.existsSync(tmpFile)) captured = true;
            } catch {}

            if (!captured) {
              results.push({ camera: cam.name, status: 'skip', reason: 'stream_offline' });
              continue;
            }

            const imageBase64 = fs.readFileSync(tmpFile).toString('base64');
            try { fs.unlinkSync(tmpFile); } catch {}

            // Enviar para a edge function analyze-camera para análise IA
            if (supabaseUrl && supabaseAnonKey) {
              try {
                const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-camera`;
                const fetchModule = require('https');
                const postData = JSON.stringify({
                  image_base64: imageBase64,
                  camera_id: cam.id,
                  camera_name: cam.name,
                  client_id: cam.client_id || null,
                  client_name: cam.client_name || null,
                  enabled_analytics: cam.analytics || [],
                });

                const analyzeResp = await new Promise((resolve, reject) => {
                  const url = new URL(analyzeUrl);
                  const reqOpts = {
                    hostname: url.hostname,
                    port: url.port || 443,
                    path: url.pathname,
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                      'apikey': supabaseAnonKey,
                      'Content-Length': Buffer.byteLength(postData),
                    },
                  };
                  const r = fetchModule.request(reqOpts, (response) => {
                    let body = '';
                    response.on('data', (chunk) => body += chunk);
                    response.on('end', () => {
                      try { resolve(JSON.parse(body)); } catch { resolve({ error: body }); }
                    });
                  });
                  r.on('error', reject);
                  r.setTimeout(30000, () => { r.destroy(); reject(new Error('Timeout')); });
                  r.write(postData);
                  r.end();
                });

                results.push({
                  camera: cam.name,
                  status: 'ok',
                  detections: analyzeResp.detections_count || 0,
                });
              } catch (aiErr) {
                console.error(`AI analysis failed for ${cam.name}:`, aiErr.message);
                results.push({ camera: cam.name, status: 'error', error: 'AI analysis failed' });
              }
            } else {
              results.push({ camera: cam.name, status: 'captured', reason: 'no_supabase_config' });
            }

            // Delay entre cameras
            if (camResult.rows.indexOf(cam) < camResult.rows.length - 1) {
              await new Promise(r => setTimeout(r, 2000));
            }

          } catch (err) {
            try { fs.unlinkSync(tmpFile); } catch {}
            results.push({ camera: cam.name, status: 'error', error: err.message });
          }
        }

        return sendJSON(res, 200, { analyzed: results.filter(r => r.status === 'ok').length, total: camResult.rows.length, results });
      } catch (err) {
        return sendJSON(res, 500, { error: 'Auto-analyze failed: ' + err.message });
      }
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Nexus Auth + API Gateway rodando em http://localhost:${PORT}`);
  console.log(`PostgREST em ${POSTGREST_URL}`);
});
