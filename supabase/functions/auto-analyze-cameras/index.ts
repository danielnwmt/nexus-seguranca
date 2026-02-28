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

    // Get all cameras with analytics enabled and a snapshot_url configured
    const { data: cameras, error: camError } = await supabase
      .from("cameras")
      .select("id, name, client_id, snapshot_url, analytics, status")
      .not("analytics", "eq", "{}")
      .not("snapshot_url", "is", null)
      .neq("snapshot_url", "")
      .eq("status", "online");

    if (camError) throw camError;
    if (!cameras || cameras.length === 0) {
      return new Response(JSON.stringify({ message: "No cameras with analytics + snapshot configured", analyzed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client names
    const clientIds = [...new Set(cameras.filter(c => c.client_id).map(c => c.client_id))];
    let clientMap: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, name")
        .in("id", clientIds);
      if (clientsData) {
        clientMap = Object.fromEntries(clientsData.map(c => [c.id, c.name]));
      }
    }

    const results: any[] = [];

    // Analyze each camera (sequentially to avoid rate limits)
    for (const cam of cameras) {
      try {
        // Call the analyze-camera function
        const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-camera`;
        const resp = await fetch(analyzeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            image_url: cam.snapshot_url,
            camera_id: cam.id,
            camera_name: cam.name,
            client_id: cam.client_id || null,
            client_name: clientMap[cam.client_id] || null,
            enabled_analytics: cam.analytics || [],
          }),
        });

        const data = await resp.json();
        results.push({ camera: cam.name, status: resp.ok ? "ok" : "error", detections: data?.detections_count || 0 });

        // Small delay between cameras to avoid rate limits
        if (cameras.indexOf(cam) < cameras.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (e) {
        console.error(`Error analyzing camera ${cam.name}:`, e);
        results.push({ camera: cam.name, status: "error", error: e instanceof Error ? e.message : "Unknown" });
      }
    }

    return new Response(JSON.stringify({
      analyzed: results.length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
