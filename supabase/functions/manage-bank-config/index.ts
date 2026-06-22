import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// AES-256-GCM helpers using BANK_ENCRYPTION_KEY (any length; SHA-256 normalized to 32 bytes)
async function getAesKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("BANK_ENCRYPTION_KEY") || "";
  if (!raw) throw new Error("BANK_ENCRYPTION_KEY not set");
  const keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encryptApiKey(plain: string): Promise<string> {
  const key = await getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv); out.set(cipher, iv.length);
  return "enc:v1:" + btoa(String.fromCharCode(...out));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }


  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Check admin role using service role client
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Support both HTTP method and body-based action routing
    const method = req.method;
    let body: any = null;
    
    try {
      if (method === "POST" || method === "PUT") {
        body = await req.json();
      }
    } catch {}

    const action = body?.action || (method === "GET" ? "list" : method === "PUT" ? "update" : method);

    if (action === "list" || (method === "GET" && !body)) {
      // Return bank configs with API keys masked
      const { data, error } = await adminClient
        .from("bank_configs")
        .select("*")
        .order("label");

      if (error) throw error;

      const masked = (data || []).map((b: any) => ({
        id: b.id,
        bank: b.bank,
        label: b.label,
        agencia: b.agencia,
        conta: b.conta,
        convenio: b.convenio,
        active: b.active,
        has_api_key: !!(b.api_key_encrypted && b.api_key_encrypted.length > 0),
        created_at: b.created_at,
        updated_at: b.updated_at,
      }));

      return new Response(JSON.stringify(masked), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { id, agencia, conta, convenio, active, api_key } = body || {};

      if (!id || typeof id !== "string") {
        return new Response(JSON.stringify({ error: "Invalid bank config ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate inputs
      const sanitize = (s: string) => (s || "").slice(0, 100);

      const updates: Record<string, any> = {
        agencia: sanitize(agencia),
        conta: sanitize(conta),
        convenio: sanitize(convenio),
        active: !!active,
      };

      // Only update API key if explicitly provided (non-empty)
      if (api_key !== undefined && api_key !== null) {
        if (typeof api_key !== "string" || api_key.length > 500) {
          return new Response(JSON.stringify({ error: "Invalid API key" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        updates.api_key_encrypted = api_key;
      }

      const { error } = await adminClient
        .from("bank_configs")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manage-bank-config error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
