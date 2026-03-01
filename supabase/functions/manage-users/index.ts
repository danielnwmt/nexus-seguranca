import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { data: claimsData, error: claimsError } = await authClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
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

        const validLevels = ["admin", "n1", "n2", "n3"];
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
        const validLevels = ["admin", "n1", "n2", "n3"];
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
