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
        let output = '';
        let commandUsed = '';

        if (fs.existsSync(scriptPath)) {
          commandUsed = `bash ${scriptPath}`;
          output = execSync(`${commandUsed} 2>&1`, { timeout: 600000 }).toString();
        } else {
          // Fallback: proteger .env e auth-server antes do checkout
          const branch = execSync(`cd ${INSTALL_DIR} && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main`).toString().trim() || 'main';
          const safeUpdate = [
            `cd ${INSTALL_DIR}`,
            `cp -f .env .env.bak 2>/dev/null || true`,
            `cp -f auth-server/server.js auth-server/server.js.bak 2>/dev/null || true`,
            `git checkout -- .`,
            `git pull origin ${branch}`,
            `cp -f .env.bak .env 2>/dev/null || true`,
            `cp -f auth-server/server.js.bak auth-server/server.js 2>/dev/null || true`,
            `npm install --legacy-peer-deps`,
            `npm run build`,
            `sudo systemctl restart nexus-auth nginx`
          ].join(' && ');
          commandUsed = safeUpdate;
          output = execSync(`${safeUpdate} 2>&1`, { timeout: 600000, shell: '/bin/bash' }).toString();
        }

        if (output.includes('Already up to date') || output.includes('ja esta na versao') || output.includes('Already up-to-date')) {
          return sendJSON(res, 200, {
            status: 'up_to_date',
            message: 'Sistema ja esta na versao mais recente.',
            command: commandUsed,
            output: output.trim()
          });
        }

        return sendJSON(res, 200, {
          status: 'updated',
          message: 'Sistema atualizado com sucesso! Recarregue a pagina.',
          command: commandUsed,
          output: output.trim()
        });
      } catch (error) {
        const stdout = error.stdout ? error.stdout.toString() : '';
        const stderr = error.stderr ? error.stderr.toString() : '';
        const output = `${stdout}\n${stderr}`.trim();

        // Se o script rodou mas retornou algo util, pode ser sucesso
        if (output.includes('atualizado') || output.includes('sucesso')) {
          return sendJSON(res, 200, {
            status: 'updated',
            message: 'Sistema atualizado com sucesso! Recarregue a pagina.',
            output
          });
        }
        return sendJSON(res, 500, {
          status: 'error',
          message: 'Erro ao atualizar: ' + error.message,
          output
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

      const results = { ip_address, rtmp: false, hls: false, mediamtx_running: false, os: serverOs || 'unknown' };

      // Testar conectividade HLS
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

      // Testar porta RTMP via TCP connect
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

      results.online = results.mediamtx_running || results.rtmp;
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
      const body = await parseBody(req);
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
