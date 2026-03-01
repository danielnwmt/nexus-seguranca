import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ANALYTICS = new Set(["lpr","weapon_detection","line_crossing","intrusion","loitering","human_car","fallen_person","people_count","tampering"]);
const MAX_BODY_SIZE = 10_000_000; // ~10MB

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
    if (contentLength > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { image_base64, image_url, camera_id, camera_name, client_id, client_name, enabled_analytics } = body;

    // Validate enabled_analytics
    if (!Array.isArray(enabled_analytics) || enabled_analytics.length === 0 || enabled_analytics.length > 20) {
      return new Response(JSON.stringify({ error: "enabled_analytics must be a non-empty array (max 20)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sanitizedAnalytics = enabled_analytics.filter((a: unknown) => typeof a === "string" && VALID_ANALYTICS.has(a));
    if (sanitizedAnalytics.length === 0) {
      return new Response(JSON.stringify({ detections: [], message: "No valid analytics types" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate optional UUIDs
    if (camera_id && (typeof camera_id !== "string" || !UUID_RE.test(camera_id))) {
      return new Response(JSON.stringify({ error: "Invalid camera_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (client_id && (typeof client_id !== "string" || !UUID_RE.test(client_id))) {
      return new Response(JSON.stringify({ error: "Invalid client_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate strings
    const safeCameraName = typeof camera_name === "string" ? camera_name.slice(0, 200) : null;
    const safeClientName = typeof client_name === "string" ? client_name.slice(0, 200) : null;

    // Validate image
    if (image_url && (typeof image_url !== "string" || image_url.length > 2048 || !/^https?:\/\/.+/.test(image_url))) {
      return new Response(JSON.stringify({ error: "Invalid image_url" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (image_base64 && (typeof image_base64 !== "string" || image_base64.length > MAX_BODY_SIZE)) {
      return new Response(JSON.stringify({ error: "image_base64 too large" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const imageContent = image_base64
      ? { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}` } }
      : image_url
        ? { type: "image_url", image_url: { url: image_url } }
        : null;

    if (!imageContent) {
      return new Response(JSON.stringify({ error: "No image provided (send image_base64 or image_url)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userMessage = `Enabled analytics: ${sanitizedAnalytics.join(", ")}\n\nAnalyze this surveillance camera image.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: ANALYTICS_PROMPT },
          { role: "user", content: [{ type: "text", text: userMessage }, imageContent] },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI analysis failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    let detections: any[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      detections = JSON.parse(cleaned);
      if (!Array.isArray(detections)) detections = [];
    } catch {
      detections = [];
    }

    const validTypes = new Set(sanitizedAnalytics);
    detections = detections.filter((d: any) => validTypes.has(d.event_type) && typeof d.confidence === "number" && d.confidence > 0.5);

    const severityMap: Record<string, string> = { weapon_detection: "critical", intrusion: "critical", fallen_person: "critical", tampering: "warning", line_crossing: "warning", loitering: "warning", lpr: "info", people_count: "info", human_car: "info" };
    const labelMap: Record<string, string> = { lpr: "Leitura de Placa", weapon_detection: "Arma Detectada", line_crossing: "Cruzamento de Linha", intrusion: "Intrusão de Área", loitering: "Vadiagem Detectada", human_car: "Classificação Humano/Carro", fallen_person: "Pessoa Caída", people_count: "Contagem de Pessoas", tampering: "Sabotagem de Câmera" };

    if (detections.length > 0) {
      const eventRows = detections.map((d: any) => ({
        camera_id: camera_id || null, camera_name: safeCameraName, client_id: client_id || null, client_name: safeClientName,
        event_type: d.event_type, confidence: d.confidence, details: d.details || {},
      }));
      const { error: evtError } = await supabase.from("analytics_events").insert(eventRows);
      if (evtError) console.error("Event insert error:", evtError);

      const alarmRows = detections
        .filter((d: any) => ["critical", "warning"].includes(severityMap[d.event_type] || ""))
        .map((d: any) => ({
          camera_id: camera_id || null, camera_name: safeCameraName, client_name: safeClientName,
          type: d.event_type, severity: severityMap[d.event_type] || "info",
          message: `${labelMap[d.event_type] || d.event_type} - Confiança: ${Math.round(d.confidence * 100)}%`, acknowledged: false,
        }));
      if (alarmRows.length > 0) {
        const { error: alarmError } = await supabase.from("alarms").insert(alarmRows);
        if (alarmError) console.error("Alarm insert error:", alarmError);
      }
    }

    return new Response(JSON.stringify({ success: true, detections_count: detections.length, detections }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-camera error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
