import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function buildReply(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('câmera') || m.includes('camera')) return 'Para verificar o status das câmeras, acesse o menu Câmeras no painel principal. Se uma câmera estiver offline, verifique a conexão de rede e o equipamento.';
  if (m.includes('alarme') || m.includes('alerta')) return 'Os alarmes são exibidos em tempo real no Dashboard. Acesse o menu Alarmes para ver o histórico completo.';
  if (m.includes('boleto') || m.includes('pagamento') || m.includes('financeiro')) return 'Para questões financeiras, acesse o menu Financeiro.';
  if (m.includes('vigilante') || m.includes('guarda')) return 'A gestão de vigilantes está no menu Vigilantes.';
  if (m.includes('cliente')) return 'O cadastro de clientes está no menu Clientes.';
  if (m.includes('backup')) return 'Para backup, acesse Configurações → Backup.';
  if (m.includes('ajuda') || m.includes('help')) return 'Posso ajudar com: 📹 Câmeras, 🚨 Alarmes, 💰 Financeiro, 👮 Vigilantes, 👥 Clientes, 💾 Backup.';
  return 'Olá! Pergunte sobre: câmeras, alarmes, financeiro, vigilantes, clientes ou backup.';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handleGupshup(req: Request, url: URL) {
  const cfgId = url.searchParams.get('cfg') || '';
  if (req.method === 'GET') return json({ ok: true });
  if (!UUID.test(cfgId)) return json({ ok: false, error: 'cfg inválido' });

  const raw = await req.text();
  if (raw.length > 50_000) return json({ ok: false, error: 'payload grande' });
  let body: any = {};
  try { body = JSON.parse(raw || '{}'); } catch { return json({ ok: true }); }

  // Gupshup v2: { type: 'message', payload: { source, type: 'text', payload: { text } } }
  if (body?.type !== 'message') return json({ ok: true });
  const p = body.payload || {};
  const from = String(p.source || p.sender?.phone || '').replace(/\D/g, '').slice(0, 20);
  const text = String(p.payload?.text || p.text || '').slice(0, 1000).trim();
  if (!from || !text) return json({ ok: true });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: cfg } = await admin.from('whatsapp_configs').select('gs_api_key, gs_app, gs_number, bot_enabled').eq('id', cfgId).maybeSingle();
  if (!cfg || !cfg.bot_enabled || !cfg.gs_api_key || !cfg.gs_number) return json({ ok: true });

  const reply = buildReply(text);
  const form = new URLSearchParams({
    channel: 'whatsapp',
    source: cfg.gs_number,
    destination: from,
    message: JSON.stringify({ type: 'text', text: reply }),
    'src.name': cfg.gs_app || '',
  });
  const r = await fetch('https://api.gupshup.io/wa/api/v1/msg', {
    method: 'POST',
    headers: { apikey: cfg.gs_api_key, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  console.log(`[Gupshup] cfg=${cfgId} to=${from} status=${r.status}`);
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('provider') === 'gupshup') return await handleGupshup(req, url);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json();
    const message = typeof body.message === "string" ? body.message.slice(0, 1000).trim() : "";
    const source = typeof body.source === "string" ? body.source.slice(0, 50) : "webhook";
    if (!message) return json({ error: 'Mensagem é obrigatória' }, 400);
    return json({ reply: buildReply(message), source, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error('Chatbot error:', e);
    return json({ error: 'Erro interno do chatbot' }, 500);
  }
});
