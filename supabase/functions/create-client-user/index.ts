import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller is admin
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem criar usuários de clientes" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, cpf } = await req.json();

    if (!client_id || !cpf) {
      return new Response(JSON.stringify({ error: "client_id e cpf são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length < 11) {
      return new Response(JSON.stringify({ error: "CPF inválido (precisa ter 11 dígitos)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = `${cpfDigits}@cliente.sys`;

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === email);

    if (existing) {
      await adminClient.from("clients").update({ user_id: existing.id }).eq("id", client_id);
      return new Response(JSON.stringify({ success: true, user_id: existing.id, message: "Usuário já existia, vinculado ao cliente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate cryptographically random temporary password (16 chars, base64url)
    const _rand = new Uint8Array(12);
    crypto.getRandomValues(_rand);
    const tempPassword = btoa(String.fromCharCode(..._rand)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    // Create new user with a random temp password; force change on first login
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { is_client: true, client_id, force_password_change: true },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Link user_id to client
    await adminClient.from("clients").update({ user_id: newUser.user.id }).eq("id", client_id);

    // Set role as n1
    const { data: existingRole } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", newUser.user.id)
      .maybeSingle();

    if (!existingRole) {
      await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role: "n1" });
    }

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
