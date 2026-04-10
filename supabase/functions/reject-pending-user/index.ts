import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase service role configuration is missing");
    }

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actorUserId = authData.user.id;

    const { data: actorRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', actorUserId);

    if (roleError) {
      throw roleError;
    }

    const canManagePendingUsers = (actorRoles || []).some((entry) => entry.role === 'admin' || entry.role === 'manager');
    if (!canManagePendingUsers) {
      return new Response(JSON.stringify({ success: false, error: "Insufficient permissions to reject users" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id } = await req.json();
    if (!target_user_id || typeof target_user_id !== 'string') {
      return new Response(JSON.stringify({ success: false, error: "target_user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, is_approved')
      .eq('user_id', target_user_id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile || profile.is_approved) {
      return new Response(JSON.stringify({ success: false, error: "No pending user matched this action." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(target_user_id);
    if (deleteError) {
      throw deleteError;
    }

    return new Response(JSON.stringify({ success: true, user_id: target_user_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reject-pending-user error:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
