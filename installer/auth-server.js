/**
 * Bravo Monitoramento - Auth Server
 * Servidor de autenticação compatível com Supabase JS Client
 * Roda junto com PostgREST para fornecer auth + REST API
 */

const http = require('http');
const { Pool } = require('pg');
const crypto = require('crypto');

// Configuração
const PORT = 8001;
const JWT_SECRET = 'bravo-monitoramento-jwt-secret-key-2024-super-seguro';
const POSTGREST_URL = 'http://127.0.0.1:3000';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'bravo',
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
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*'
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
    headers['access-control-allow-headers'] = '*';
    headers['access-control-allow-methods'] = '*';
    
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
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*'
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
  console.log(`Bravo Auth + API Gateway rodando em http://localhost:${PORT}`);
  console.log(`PostgREST em ${POSTGREST_URL}`);
});
