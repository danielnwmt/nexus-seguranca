import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_EVENT_TYPES = new Set(["lpr","weapon_detection","line_crossing","intrusion","loitering","human_car","fallen_person","people_count","tampering","motion"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- Input validation ---
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > 1_000_000) {
      return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const rawEvents: any[] = Array.isArray(body) ? body : [body];

    if (rawEvents.length > 100) {
      return new Response(JSON.stringify({ error: "Too many events (max 100)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const severityMap: Record<string, string> = { weapon_detection: "critical", intrusion: "critical", fallen_person: "critical", tampering: "warning", line_crossing: "warning", loitering: "warning", lpr: "info", people_count: "info", human_car: "info" };
    const labelMap: Record<string, string> = { lpr: "Leitura de Placa", weapon_detection: "Arma Detectada", line_crossing: "Cruzamento de Linha", intrusion: "Intrusão de Área", loitering: "Vadiagem Detectada", human_car: "Classificação Humano/Carro", fallen_person: "Pessoa Caída", people_count: "Contagem de Pessoas", tampering: "Sabotagem de Câmera" };

    const analyticsRows = [];
    const alarmRows = [];

    for (const evt of rawEvents) {
      const camera_id = typeof evt.camera_id === "string" && UUID_RE.test(evt.camera_id) ? evt.camera_id : null;
      const client_id = typeof evt.client_id === "string" && UUID_RE.test(evt.client_id) ? evt.client_id : null;
      const event_type = typeof evt.event_type === "string" && VALID_EVENT_TYPES.has(evt.event_type) ? evt.event_type : "motion";
      const confidence = typeof evt.confidence === "number" && evt.confidence >= 0 && evt.confidence <= 1 ? evt.confidence : 0;
      const camera_name = typeof evt.camera_name === "string" ? evt.camera_name.slice(0, 200) : null;
      const client_name = typeof evt.client_name === "string" ? evt.client_name.slice(0, 200) : null;
      const details = typeof evt.details === "object" && evt.details !== null && !Array.isArray(evt.details) ? evt.details : {};
      const thumbnail_url = typeof evt.thumbnail_url === "string" && evt.thumbnail_url.length < 2048 ? evt.thumbnail_url : null;

      analyticsRows.push({ camera_id, camera_name, client_id, client_name, event_type, confidence, details, thumbnail_url });

      const severity = severityMap[event_type] || "info";
      if (severity === "critical" || severity === "warning") {
        alarmRows.push({
          camera_id, camera_name, client_name, type: event_type, severity,
          message: `${labelMap[event_type] || event_type} - Confiança: ${Math.round(confidence * 100)}%`, acknowledged: false,
        });
      }
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error: evtError } = await supabase.from("analytics_events").insert(analyticsRows);
    if (evtError) throw evtError;

    if (alarmRows.length > 0) {
      const { error: alarmError } = await supabase.from("alarms").insert(alarmRows);
      if (alarmError) console.error("Alarm insert error:", alarmError);
    }

    return new Response(JSON.stringify({ success: true, events_count: analyticsRows.length, alarms_count: alarmRows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analytics-webhook error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
