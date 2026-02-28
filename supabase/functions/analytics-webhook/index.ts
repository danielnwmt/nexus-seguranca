import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();

    // Accept single event or array
    const events: any[] = Array.isArray(body) ? body : [body];

    const severityMap: Record<string, string> = {
      weapon_detection: "critical",
      intrusion: "critical",
      fallen_person: "critical",
      tampering: "warning",
      line_crossing: "warning",
      loitering: "warning",
      lpr: "info",
      people_count: "info",
      human_car: "info",
    };

    const labelMap: Record<string, string> = {
      lpr: "Leitura de Placa",
      weapon_detection: "Arma Detectada",
      line_crossing: "Cruzamento de Linha",
      intrusion: "Intrusão de Área",
      loitering: "Vadiagem Detectada",
      human_car: "Classificação Humano/Carro",
      fallen_person: "Pessoa Caída",
      people_count: "Contagem de Pessoas",
      tampering: "Sabotagem de Câmera",
    };

    const analyticsRows = [];
    const alarmRows = [];

    for (const evt of events) {
      const { camera_id, camera_name, client_id, client_name, event_type, confidence, details, thumbnail_url } = evt;

      analyticsRows.push({
        camera_id: camera_id || null,
        camera_name: camera_name || null,
        client_id: client_id || null,
        client_name: client_name || null,
        event_type: event_type || "motion",
        confidence: confidence || 0,
        details: details || {},
        thumbnail_url: thumbnail_url || null,
      });

      // Auto-create alarm for critical/warning events
      const severity = severityMap[event_type] || "info";
      if (severity === "critical" || severity === "warning") {
        alarmRows.push({
          camera_id: camera_id || null,
          camera_name: camera_name || null,
          client_name: client_name || null,
          type: event_type,
          severity,
          message: `${labelMap[event_type] || event_type} - Confiança: ${Math.round((confidence || 0) * 100)}%`,
          acknowledged: false,
        });
      }
    }

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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
