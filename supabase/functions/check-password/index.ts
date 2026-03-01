const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate content length (max 1KB)
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > 1024) {
      return new Response(
        JSON.stringify({ error: "Payload too large" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { password } = await req.json();

    if (!password || typeof password !== "string" || password.length < 1 || password.length > 128) {
      return new Response(
        JSON.stringify({ error: "Invalid password parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use HaveIBeenPwned k-anonymity model
    // Hash the password with SHA-1, send only first 5 chars (prefix)
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    // Query HIBP API with prefix only (password never leaves the server)
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });

    if (!response.ok) {
      // If HIBP is down, allow the password (don't block users)
      return new Response(
        JSON.stringify({ leaked: false, count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const text = await response.text();
    const lines = text.split("\n");

    let count = 0;
    for (const line of lines) {
      const [hashSuffix, hashCount] = line.trim().split(":");
      if (hashSuffix === suffix) {
        count = parseInt(hashCount, 10);
        break;
      }
    }

    return new Response(
      JSON.stringify({ leaked: count > 0, count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
