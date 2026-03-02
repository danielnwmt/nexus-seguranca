import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar TODAS as cameras com analytics (não apenas as com snapshot_url)
    const { data: cameras, error: camError } = await supabase
      .from("cameras")
      .select("id, name, client_id, snapshot_url, analytics, status, stream_key")
      .not("analytics", "eq", "{}")
      .eq("status", "online");

    if (camError) throw camError;
    if (!cameras || cameras.length === 0) {
      return new Response(JSON.stringify({ message: "No cameras with analytics configured", analyzed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar media server para construir URLs HLS
    const { data: mediaServers } = await supabase
      .from("media_servers")
      .select("ip_address, hls_base_port")
      .eq("status", "online")
      .limit(1);

    const mediaIp = mediaServers?.[0]?.ip_address || null;
    const hlsPort = mediaServers?.[0]?.hls_base_port || 8888;

    const clientIds = [...new Set(cameras.filter(c => c.client_id).map(c => c.client_id))];
    let clientMap: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: clientsData } = await supabase.from("clients").select("id, name").in("id", clientIds);
      if (clientsData) clientMap = Object.fromEntries(clientsData.map(c => [c.id, c.name]));
    }

    const results: any[] = [];

    for (const cam of cameras) {
      try {
        // Determinar a fonte da imagem
        let imagePayload: Record<string, any> = {};

        if (cam.snapshot_url) {
          // Usar snapshot URL direta (câmeras com endpoint HTTP de snapshot)
          imagePayload = { image_url: cam.snapshot_url };
        } else if (mediaIp && cam.stream_key) {
          // Sem snapshot URL: tentar capturar do HLS via servidor local
          // O auth-server expõe /api/cameras/snapshot que usa ffmpeg
          try {
            const snapshotResp = await fetch(`http://${mediaIp}:8001/api/cameras/snapshot`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: authHeader },
              body: JSON.stringify({ stream_key: cam.stream_key }),
            });

            if (snapshotResp.ok) {
              const snapData = await snapshotResp.json();
              if (snapData.image_base64) {
                imagePayload = { image_base64: snapData.image_base64 };
              }
            }
          } catch (e) {
            console.error(`Snapshot capture failed for ${cam.name}:`, e);
          }
        }

        // Se não conseguiu imagem, pular
        if (!imagePayload.image_url && !imagePayload.image_base64) {
          results.push({ camera: cam.name, status: "skip", reason: "no_image_source" });
          continue;
        }

        const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-camera`;
        const resp = await fetch(analyzeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({
            ...imagePayload,
            camera_id: cam.id,
            camera_name: cam.name,
            client_id: cam.client_id || null,
            client_name: clientMap[cam.client_id] || null,
            enabled_analytics: cam.analytics || [],
          }),
        });

        const data = await resp.json();
        results.push({ camera: cam.name, status: resp.ok ? "ok" : "error", detections: data?.detections_count || 0 });

        // Delay entre cameras para não sobrecarregar
        if (cameras.indexOf(cam) < cameras.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (e) {
        console.error(`Error analyzing camera ${cam.name}:`, e);
        results.push({ camera: cam.name, status: "error", error: "Analysis failed" });
      }
    }

    return new Response(JSON.stringify({ analyzed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-analyze error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});