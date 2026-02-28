import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYTICS_PROMPT = `You are a professional video surveillance AI analyst. Analyze this camera image and detect the following events based on the enabled analytics.

For each detection, return a JSON array of objects with:
- "event_type": one of the enabled analytics types
- "confidence": number between 0 and 1
- "details": object with relevant details

Analytics types and what to look for:
- "lpr": License plate recognition - detect any vehicle license plates, return plate text in details
- "weapon_detection": Detect firearms, knives, or weapons
- "line_crossing": Detect people or vehicles crossing defined boundary areas
- "intrusion": Detect unauthorized persons in restricted areas
- "loitering": Detect people standing idle for extended time
- "human_car": Classify detected objects as human or vehicle, return counts
- "fallen_person": Detect people who have fallen or are lying on the ground
- "people_count": Count the number of people visible, return count in details
- "tampering": Detect camera obstruction, blur, or repositioning

IMPORTANT: Only analyze for the analytics types listed in the enabled list. If nothing is detected, return an empty array.
Be conservative - only report detections with confidence > 0.5.
Respond ONLY with the JSON array, no other text.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { image_base64, image_url, camera_id, camera_name, client_id, client_name, enabled_analytics } = await req.json();

    if (!enabled_analytics || enabled_analytics.length === 0) {
      return new Response(JSON.stringify({ detections: [], message: "No analytics enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageContent = image_base64
      ? { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}` } }
      : image_url
        ? { type: "image_url", image_url: { url: image_url } }
        : null;

    if (!imageContent) {
      return new Response(JSON.stringify({ error: "No image provided (send image_base64 or image_url)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMessage = `Enabled analytics: ${enabled_analytics.join(", ")}

Analyze this surveillance camera image.`;

    // Call Lovable AI with vision
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: ANALYTICS_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userMessage },
              imageContent,
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    // Parse detections from AI response
    let detections: any[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      detections = JSON.parse(cleaned);
      if (!Array.isArray(detections)) detections = [];
    } catch {
      console.error("Failed to parse AI response:", content);
      detections = [];
    }

    // Filter only valid analytics types and confidence > 0.5
    const validTypes = new Set(enabled_analytics);
    detections = detections.filter((d: any) => validTypes.has(d.event_type) && d.confidence > 0.5);

    // Severity mapping
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

    // Save detections to analytics_events
    if (detections.length > 0) {
      const eventRows = detections.map((d: any) => ({
        camera_id: camera_id || null,
        camera_name: camera_name || null,
        client_id: client_id || null,
        client_name: client_name || null,
        event_type: d.event_type,
        confidence: d.confidence,
        details: d.details || {},
      }));

      const { error: evtError } = await supabase.from("analytics_events").insert(eventRows);
      if (evtError) console.error("Event insert error:", evtError);

      // Generate alarms for critical/warning events
      const alarmRows = detections
        .filter((d: any) => ["critical", "warning"].includes(severityMap[d.event_type] || ""))
        .map((d: any) => ({
          camera_id: camera_id || null,
          camera_name: camera_name || null,
          client_name: client_name || null,
          type: d.event_type,
          severity: severityMap[d.event_type] || "info",
          message: `${labelMap[d.event_type] || d.event_type} - Confiança: ${Math.round(d.confidence * 100)}%`,
          acknowledged: false,
        }));

      if (alarmRows.length > 0) {
        const { error: alarmError } = await supabase.from("alarms").insert(alarmRows);
        if (alarmError) console.error("Alarm insert error:", alarmError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      detections_count: detections.length,
      detections,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("analyze-camera error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
