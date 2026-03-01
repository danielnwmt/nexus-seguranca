import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit payload size
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > 50_000) {
      return new Response(
        JSON.stringify({ error: 'Payload too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const message = typeof body.message === "string" ? body.message.slice(0, 1000).trim() : "";
    const source = typeof body.source === "string" ? body.source.slice(0, 50) : "webhook";
    const phone = typeof body.phone === "string" ? body.phone.replace(/[^0-9+\-() ]/g, "").slice(0, 20) : null;

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Mensagem é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let reply = '';
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('câmera') || lowerMsg.includes('camera')) {
      reply = 'Para verificar o status das câmeras, acesse o menu Câmeras no painel principal. Se uma câmera estiver offline, verifique a conexão de rede e o equipamento.';
    } else if (lowerMsg.includes('alarme') || lowerMsg.includes('alerta')) {
      reply = 'Os alarmes são exibidos em tempo real no Dashboard. Alarmes críticos geram notificações automáticas. Acesse o menu Alarmes para ver o histórico completo.';
    } else if (lowerMsg.includes('boleto') || lowerMsg.includes('pagamento') || lowerMsg.includes('financeiro')) {
      reply = 'Para questões financeiras, acesse o menu Financeiro. Lá você pode gerar cobranças, registrar boletos e acompanhar pagamentos.';
    } else if (lowerMsg.includes('vigilante') || lowerMsg.includes('guarda')) {
      reply = 'A gestão de vigilantes está no menu Vigilantes. Você pode cadastrar, editar turnos e vincular a clientes específicos.';
    } else if (lowerMsg.includes('cliente')) {
      reply = 'O cadastro de clientes está no menu Clientes. Cada cliente pode ter câmeras, mensalidade e servidor de gravação vinculados.';
    } else if (lowerMsg.includes('backup')) {
      reply = 'Para fazer backup, acesse Configurações → aba Backup. Você pode exportar todos os dados do sistema em formato JSON.';
    } else if (lowerMsg.includes('ajuda') || lowerMsg.includes('help')) {
      reply = 'Posso ajudar com: 📹 Câmeras, 🚨 Alarmes, 💰 Financeiro, 👮 Vigilantes, 👥 Clientes, 💾 Backup. Sobre o que deseja saber?';
    } else {
      reply = 'Para ajuda específica, pergunte sobre: câmeras, alarmes, financeiro, vigilantes, clientes ou backup.';
    }

    console.log(`[Chatbot] User: ${user.id} | Source: ${source} | Phone: ${phone || 'N/A'}`);

    return new Response(
      JSON.stringify({ reply, source, timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Chatbot error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do chatbot' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
