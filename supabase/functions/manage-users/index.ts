import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const generateTemporaryPassword = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const randomPart = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `Nx!${randomPart}7a`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Missing authentication configuration");
    }

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
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "owner"])
      .limit(1)
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Administrator access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // LIST users
    if (req.method === "GET") {
      const { data: authUsers, error: listErr } = await adminClient.auth.admin.listUsers();
      if (listErr) throw listErr;

      const { data: roles } = await adminClient.from("user_roles").select("*");

      const users = (authUsers?.users || []).map((u: any) => {
        const userRole = (roles || []).find((r: any) => r.user_id === u.id);
        return {
          id: u.id,
          email: u.email,
          name: u.user_metadata?.name || u.email?.split("@")[0] || "",
          level: userRole?.role || "n1",
          active: !u.banned_until,
          created_at: u.created_at,
        };
      });

      return new Response(JSON.stringify(users), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE / UPDATE / DELETE
    if (req.method === "POST") {
      const body = await req.json();

      if (!body.action) {
        return new Response(JSON.stringify({ error: "Action required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.action === "get_company_access") {
        if (roleData.role !== "owner") {
          return new Response(JSON.stringify({ error: "Owner access required" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const companyId = typeof body.company_id === "string" ? body.company_id : "";
        const { data: membership, error: membershipError } = await adminClient
          .from("saas_company_users")
          .select("user_id")
          .eq("company_id", companyId)
          .maybeSingle();
        if (membershipError) throw membershipError;
        if (!membership) {
          return new Response(JSON.stringify({ user: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: authUser, error: userError } = await adminClient.auth.admin.getUserById(membership.user_id);
        if (userError) throw userError;
        return new Response(JSON.stringify({
          user: {
            id: authUser.user.id,
            email: authUser.user.email || "",
            name: authUser.user.user_metadata?.name || "",
          },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (body.action === "save_company_access") {
        if (roleData.role !== "owner") {
          return new Response(JSON.stringify({ error: "Owner access required" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const companyId = typeof body.company_id === "string" ? body.company_id : "";
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 255) : "";
        const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
        const requestedPassword = typeof body.password === "string" ? body.password : "";
        if (!companyId || !email || !name) {
          return new Response(JSON.stringify({ error: "Empresa, nome e e-mail são obrigatórios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: company } = await adminClient.from("saas_companies").select("id").eq("id", companyId).maybeSingle();
        if (!company) {
          return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: membership, error: membershipError } = await adminClient
          .from("saas_company_users")
          .select("user_id")
          .eq("company_id", companyId)
          .maybeSingle();
        if (membershipError) throw membershipError;

        if (membership) {
          if (requestedPassword && requestedPassword.length < 8) {
            return new Response(JSON.stringify({ error: "A senha deve ter pelo menos 8 caracteres" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const attributes: Record<string, unknown> = { email, email_confirm: true, user_metadata: { name } };
          if (requestedPassword) {
            attributes.password = requestedPassword;
            attributes.user_metadata = { name, company_id: companyId, force_password_change: true };
          }
          const { error: updateError } = await adminClient.auth.admin.updateUserById(membership.user_id, attributes);
          if (updateError) {
            return new Response(JSON.stringify({ error: updateError.message }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const { error: roleError } = await adminClient
            .from("user_roles")
            .update({ role: "admin" })
            .eq("user_id", membership.user_id);
          if (roleError) throw roleError;
          return new Response(JSON.stringify({ success: true, user_id: membership.user_id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const password = requestedPassword || generateTemporaryPassword();

        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name, company_id: companyId, force_password_change: true },
        });
        if (createError || !newUser.user) {
          return new Response(JSON.stringify({ error: createError?.message || "Não foi possível criar o usuário" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: linkError } = await adminClient.from("saas_company_users").insert({ company_id: companyId, user_id: newUser.user.id });
        if (linkError) {
          await adminClient.auth.admin.deleteUser(newUser.user.id);
          return new Response(JSON.stringify({ error: linkError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: roleError } = await adminClient
          .from("user_roles")
          .update({ role: "admin" })
          .eq("user_id", newUser.user.id);
        if (roleError) {
          await adminClient.from("saas_company_users").delete().eq("user_id", newUser.user.id);
          await adminClient.auth.admin.deleteUser(newUser.user.id);
          throw roleError;
        }

        return new Response(JSON.stringify({ success: true, user_id: newUser.user.id, temporary_password: password }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.action === "reset_company_password") {
        if (roleData.role !== "owner") {
          return new Response(JSON.stringify({ error: "Owner access required" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const companyId = typeof body.company_id === "string" ? body.company_id : "";
        if (!companyId) {
          return new Response(JSON.stringify({ error: "Empresa obrigatória" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: membership, error: membershipError } = await adminClient
          .from("saas_company_users")
          .select("user_id")
          .eq("company_id", companyId)
          .maybeSingle();
        if (membershipError) throw membershipError;
        if (!membership) {
          return new Response(JSON.stringify({ error: "Usuário da empresa não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: targetUser, error: targetUserError } = await adminClient.auth.admin.getUserById(membership.user_id);
        if (targetUserError || !targetUser.user) {
          return new Response(JSON.stringify({ error: "Usuário da empresa não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const temporaryPassword = generateTemporaryPassword();
        const { error: resetError } = await adminClient.auth.admin.updateUserById(membership.user_id, {
          password: temporaryPassword,
          user_metadata: { ...targetUser.user.user_metadata, force_password_change: true },
        });
        if (resetError) {
          return new Response(JSON.stringify({ error: resetError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, temporary_password: temporaryPassword }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.action === "create") {
        const { email, password, name, level } = body;

        if (!email || !password || typeof email !== "string" || typeof password !== "string") {
          return new Response(JSON.stringify({ error: "Email and password required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (password.length < 8) {
          return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

    const validLevels = ["admin", "n1", "n2", "n3", "owner"];
        const userLevel = validLevels.includes(level) ? level : "n1";

        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email: email.slice(0, 255),
          password,
          email_confirm: true,
          user_metadata: { 
            name: (name || "").slice(0, 100),
            force_password_change: true,
          },
        });

        if (createErr) {
          return new Response(JSON.stringify({ error: createErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update role if not default
        if (userLevel !== "n1" && newUser?.user) {
          await adminClient
            .from("user_roles")
            .update({ role: userLevel })
            .eq("user_id", newUser.user.id);
        }

        return new Response(JSON.stringify({ success: true, user_id: newUser?.user?.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.action === "update") {
        const { user_id, name, level, active } = body;

        if (!user_id || typeof user_id !== "string") {
          return new Response(JSON.stringify({ error: "User ID required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: targetRole } = await adminClient.from("user_roles").select("role").eq("user_id", user_id).eq("role", "owner").maybeSingle();
        if (targetRole && user_id !== userId) {
          return new Response(JSON.stringify({ error: "Owner account is protected" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Prevent self-demotion from admin
        if (user_id === userId && level !== "admin") {
          return new Response(JSON.stringify({ error: "Cannot demote yourself" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update auth metadata
        await adminClient.auth.admin.updateUserById(user_id, {
          user_metadata: { name: (name || "").slice(0, 100) },
          ban_duration: active === false ? "876000h" : "none",
        });

        // Update role
        const validLevels = ["admin", "n1", "n2", "n3", "owner"];
        if (level && validLevels.includes(level)) {
          await adminClient
            .from("user_roles")
            .update({ role: level })
            .eq("user_id", user_id);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.action === "reset_password") {
        const { user_id, password } = body;

        if (!user_id || typeof user_id !== "string") {
          return new Response(JSON.stringify({ error: "User ID required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const requestedPassword = typeof password === "string" ? password : "";
        if (requestedPassword && (roleData.role !== "owner" || user_id !== userId)) {
          return new Response(JSON.stringify({ error: "Only the owner can define their own temporary password" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (requestedPassword && requestedPassword.length < 8) {
          return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const tempPassword = requestedPassword || generateTemporaryPassword();

        const { data: targetUser, error: targetUserError } = await adminClient.auth.admin.getUserById(user_id);
        if (targetUserError || !targetUser.user) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: resetErr } = await adminClient.auth.admin.updateUserById(user_id, {
          password: tempPassword,
          user_metadata: { ...targetUser.user.user_metadata, force_password_change: true },
        });

        if (resetErr) {
          return new Response(JSON.stringify({ error: resetErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, temporary_password: tempPassword }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.action === "delete") {
        const { user_id } = body;

        if (!user_id || typeof user_id !== "string") {
          return new Response(JSON.stringify({ error: "User ID required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (user_id === userId) {
          return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }


        const { data: targetRole } = await adminClient.from("user_roles").select("role").eq("user_id", user_id).eq("role", "owner").maybeSingle();
        if (targetRole) {
          return new Response(JSON.stringify({ error: "Owner account is protected" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await adminClient.from("user_roles").delete().eq("user_id", user_id);
        const { error: delErr } = await adminClient.auth.admin.deleteUser(user_id);
        if (delErr) throw delErr;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manage-users error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
