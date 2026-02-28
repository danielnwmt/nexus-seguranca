/**
 * Nexus Monitoramento - Analytics Service
 * Serviço local de análise de vídeo por IA em tempo real
 * Captura frames das câmeras via MediaMTX (HLS) usando ffmpeg
 * e envia para a Edge Function analyze-camera
 * 
 * Roda como serviço no servidor junto com o MediaMTX
 */

const { execSync, spawn } = require('child_process');
const https = require('https');
const http = require('http');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ========== CONFIGURAÇÃO ==========
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const MEDIAMTX_API = process.env.MEDIAMTX_API || 'http://127.0.0.1:9997';
const MEDIAMTX_HLS = process.env.MEDIAMTX_HLS || 'http://127.0.0.1:8888';
const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = parseInt(process.env.PG_PORT || '5432');
const PG_DB = process.env.PG_DB || 'nexus';
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASS = process.env.PG_PASS || '';
const TEMP_DIR = process.env.TEMP_DIR || path.join(__dirname, 'snapshots');
const DEFAULT_INTERVAL = parseInt(process.env.ANALYZE_INTERVAL || '15'); // seconds

// Intervalos por tipo de analítico (segundos)
const ANALYTIC_INTERVALS = {
  lpr: 10,                     // Placas mudam rápido
  weapon_detection: 8,         // Crítico - mais frequente
  line_crossing: 12,
  area_intrusion: 10,          // Crítico
  loitering: 30,               // Vadiagem precisa de tempo
  human_car_classification: 20,
  fallen_person: 10,           // Crítico
  people_counting: 30,
  tampering: 60,               // Sabotagem é rara
};

// ========== BANCO DE DADOS ==========
const pool = new Pool({
  host: PG_HOST,
  port: PG_PORT,
  database: PG_DB,
  user: PG_USER,
  password: PG_PASS,
});

// ========== ESTADO ==========
const cameraTimers = new Map(); // camera_id -> { interval, lastAnalysis, timer }
let isRunning = true;

// ========== UTILIDADES ==========
function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function logError(msg, err) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] ERROR: ${msg}`, err?.message || err || '');
}

// Criar pasta temporária
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ========== VERIFICAR FFMPEG ==========
function checkFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ========== CAPTURAR FRAME VIA FFMPEG ==========
function captureFrame(hlsUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',                    // overwrite
      '-i', hlsUrl,            // input HLS stream
      '-vframes', '1',         // capturar 1 frame
      '-q:v', '2',             // qualidade JPEG
      '-f', 'image2',          // formato de saída
      outputPath
    ];

    const proc = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,          // timeout 15s
    });

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-200)}`));
      }
    });

    proc.on('error', reject);

    // Kill se demorar muito
    setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch {}
    }, 15000);
  });
}

// ========== VERIFICAR STREAM ATIVO NO MEDIAMTX ==========
async function getActiveStreams() {
  return new Promise((resolve) => {
    const url = `${MEDIAMTX_API}/v3/paths/list`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', (d) => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const items = parsed.items || [];
          const active = items
            .filter(p => p.ready && p.readers !== undefined)
            .map(p => p.name);
          resolve(active);
        } catch {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

// ========== ENVIAR PARA ANÁLISE ==========
async function analyzeFrame(imagePath, camera) {
  const imageBase64 = fs.readFileSync(imagePath).toString('base64');
  
  const body = JSON.stringify({
    image_base64: imageBase64,
    camera_id: camera.id,
    camera_name: camera.name,
    client_id: camera.client_id || null,
    client_name: camera.client_name || null,
    enabled_analytics: camera.analytics || [],
  });

  const analyzeUrl = `${SUPABASE_URL}/functions/v1/analyze-camera`;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(analyzeUrl);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const proto = urlObj.protocol === 'https:' ? https : http;
    const req = proto.request(options, (res) => {
      let data = '';
      res.on('data', (d) => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch {
          resolve({ error: 'parse error', raw: data.slice(0, 200) });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// ========== BUSCAR CÂMERAS COM ANALÍTICOS ==========
async function getCamerasWithAnalytics() {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.stream_key, c.analytics, c.status, c.snapshot_url,
             c.client_id, cl.name as client_name
      FROM cameras c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.status = 'online'
        AND c.analytics IS NOT NULL
        AND array_length(c.analytics, 1) > 0
    `);
    return result.rows;
  } catch (err) {
    logError('Erro ao buscar câmeras', err);
    return [];
  }
}

// ========== CALCULAR INTERVALO DA CÂMERA ==========
function getCameraInterval(analytics) {
  if (!analytics || analytics.length === 0) return DEFAULT_INTERVAL;
  // Usar o menor intervalo entre os analíticos habilitados
  let min = DEFAULT_INTERVAL;
  for (const a of analytics) {
    const interval = ANALYTIC_INTERVALS[a] || DEFAULT_INTERVAL;
    if (interval < min) min = interval;
  }
  return min;
}

// ========== ANALISAR UMA CÂMERA ==========
async function analyzeCamera(camera, activeStreams) {
  const streamKey = camera.stream_key;
  
  // Verificar se o stream está ativo no MediaMTX
  const isStreamActive = activeStreams.includes(streamKey) || 
                         activeStreams.includes(`live/${streamKey}`) ||
                         activeStreams.some(s => s.includes(streamKey));

  if (!isStreamActive && !camera.snapshot_url) {
    return; // Stream não ativo e sem snapshot URL
  }

  const snapshotPath = path.join(TEMP_DIR, `${camera.id}.jpg`);

  try {
    if (isStreamActive) {
      // Capturar via HLS do MediaMTX
      const hlsUrl = `${MEDIAMTX_HLS}/${streamKey}/`;
      await captureFrame(hlsUrl, snapshotPath);
    } else if (camera.snapshot_url) {
      // Capturar via snapshot URL da câmera
      await captureFrame(camera.snapshot_url, snapshotPath);
    }

    // Enviar para análise
    const result = await analyzeFrame(snapshotPath, camera);
    
    if (result.detections_count > 0) {
      log(`📸 ${camera.name}: ${result.detections_count} detecção(ões) - ${result.detections.map(d => `${d.event_type}(${Math.round(d.confidence * 100)}%)`).join(', ')}`);
    }

    // Limpar snapshot temporário
    try { fs.unlinkSync(snapshotPath); } catch {}

  } catch (err) {
    logError(`Falha ao analisar ${camera.name}`, err);
    try { fs.unlinkSync(snapshotPath); } catch {}
  }
}

// ========== LOOP PRINCIPAL ==========
async function mainLoop() {
  log('🔍 Verificando câmeras...');
  
  const cameras = await getCamerasWithAnalytics();
  const activeStreams = await getActiveStreams();
  
  if (cameras.length === 0) {
    log('Nenhuma câmera com analíticos habilitados');
    return;
  }

  log(`📹 ${cameras.length} câmera(s) com analíticos | ${activeStreams.length} stream(s) ativo(s)`);

  // Atualizar timers para cada câmera
  const currentIds = new Set(cameras.map(c => c.id));

  // Remover timers de câmeras que não existem mais
  for (const [id, state] of cameraTimers) {
    if (!currentIds.has(id)) {
      clearInterval(state.timer);
      cameraTimers.delete(id);
      log(`⏹ Timer removido para câmera removida`);
    }
  }

  // Criar/atualizar timers para câmeras ativas
  for (const camera of cameras) {
    const interval = getCameraInterval(camera.analytics);
    const existing = cameraTimers.get(camera.id);

    if (existing && existing.interval === interval) {
      // Timer já existe com mesmo intervalo, atualizar referência da câmera
      existing.camera = camera;
      continue;
    }

    // Limpar timer antigo se existir
    if (existing) {
      clearInterval(existing.timer);
    }

    // Criar novo timer
    const state = {
      interval,
      camera,
      timer: setInterval(async () => {
        if (!isRunning) return;
        const streams = await getActiveStreams();
        await analyzeCamera(state.camera, streams);
      }, interval * 1000),
    };

    cameraTimers.set(camera.id, state);
    log(`⏱ ${camera.name}: análise a cada ${interval}s [${camera.analytics.join(', ')}]`);

    // Análise inicial imediata
    setTimeout(async () => {
      const streams = await getActiveStreams();
      await analyzeCamera(camera, streams);
    }, Math.random() * 5000); // Escalonar para evitar sobrecarga
  }
}

// ========== INICIALIZAÇÃO ==========
async function start() {
  console.log('');
  console.log('=============================================');
  console.log('  NEXUS - Serviço de Análise por IA');
  console.log('  Análise de vídeo em tempo real');
  console.log('=============================================');
  console.log('');

  // Verificar ffmpeg
  if (!checkFfmpeg()) {
    logError('ffmpeg não encontrado! Instale: https://ffmpeg.org/download.html');
    process.exit(1);
  }
  log('✅ ffmpeg encontrado');

  // Verificar banco
  try {
    await pool.query('SELECT 1');
    log('✅ Banco de dados conectado');
  } catch (err) {
    logError('Falha ao conectar no banco', err);
    process.exit(1);
  }

  // Verificar Supabase URL
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    logError('SUPABASE_URL e SUPABASE_KEY devem estar configurados');
    process.exit(1);
  }
  log(`✅ Supabase: ${SUPABASE_URL}`);

  // Verificar MediaMTX
  const streams = await getActiveStreams();
  log(`✅ MediaMTX: ${streams.length} stream(s) ativo(s)`);

  // Executar loop principal imediatamente
  await mainLoop();

  // Recarregar câmeras a cada 60 segundos
  setInterval(mainLoop, 60000);

  log('🚀 Serviço de análise iniciado!');
}

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGINT', () => {
  log('⏹ Encerrando serviço...');
  isRunning = false;
  for (const [, state] of cameraTimers) {
    clearInterval(state.timer);
  }
  pool.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('⏹ Encerrando serviço...');
  isRunning = false;
  for (const [, state] of cameraTimers) {
    clearInterval(state.timer);
  }
  pool.end();
  process.exit(0);
});

start().catch(err => {
  logError('Falha ao iniciar', err);
  process.exit(1);
});
