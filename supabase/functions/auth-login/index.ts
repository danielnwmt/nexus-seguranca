import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BODY_SIZE = 1024; // 1KB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password } = body;

    // Validate inputs
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return new Response(JSON.stringify({ error: "Email and password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (email.length > 255 || password.length > 128) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Normalize identifier (lowercase email for consistent tracking)
    const identifier = email.toLowerCase().trim();

    // Check rate limit server-side
    const { data: rateLimitResult, error: rlError } = await adminClient.rpc("check_rate_limit", {
      _identifier: identifier,
      _max_attempts: 5,
      _window_minutes: 15,
      _lockout_minutes: 30,
    });

    if (rlError) {
      console.error("Rate limit check error:", rlError);
      // Don't block login if rate limit check fails, but log it
    }

    if (rateLimitResult && !rateLimitResult.allowed) {
      const remainingSeconds = rateLimitResult.remaining_seconds || 1800;
      return new Response(
        JSON.stringify({
          error: "rate_limited",
          message: `Muitas tentativas. Tente novamente em ${Math.ceil(remainingSeconds / 60)} minutos.`,
          locked_until: rateLimitResult.locked_until,
          remaining_seconds: remainingSeconds,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Attempt login using anon client
    const authClient = createClient(supabaseUrl, anonKey);
    const { data, error } = await authClient.auth.signInWithPassword({
      email: identifier,
      password,
    });

    if (error) {
      // Login failed - rate limit already incremented by check_rate_limit
      const remaining = rateLimitResult?.remaining_attempts;
      return new Response(
        JSON.stringify({
          error: "invalid_credentials",
          message: "Email ou senha inválidos",
          remaining_attempts: remaining,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Login successful - reset rate limit
    await adminClient.rpc("reset_rate_limit", { _identifier: identifier });

    return new Response(
      JSON.stringify({
        session: data.session,
        user: data.user,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("auth-login error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
