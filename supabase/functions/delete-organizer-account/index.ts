import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "globalcatholiccalendar@gmail.com";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify caller is the admin
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const callerEmail = (userData.user.email || "").toLowerCase();
    if (callerEmail !== ADMIN_EMAIL) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => null);
    const userId = body?.user_id;
    if (typeof userId !== "string" || !userId) {
      return json({ error: "user_id required" }, 400);
    }
    if (userId === userData.user.id) {
      return json({ error: "Cannot delete the admin account from here." }, 400);
    }

    // Clean up app data tied to this user (best-effort; ignore individual failures)
    await admin.from("direct_messages").delete().or(`sender_user_id.eq.${userId},recipient_user_id.eq.${userId}`);
    await admin.from("discussion_replies").delete().eq("author_user_id", userId);
    // Delete threads they started (and their replies cascade-or-not, do replies first)
    const { data: threads } = await admin
      .from("discussion_threads")
      .select("id")
      .eq("author_user_id", userId);
    if (threads && threads.length > 0) {
      const ids = threads.map((t: any) => t.id);
      await admin.from("discussion_replies").delete().in("thread_id", ids);
      await admin.from("discussion_threads").delete().in("id", ids);
    }
    await admin.from("calendar_events").delete().eq("submitted_by_user_id", userId);
    await admin.from("organizer_profiles").delete().eq("user_id", userId);
    await admin.from("user_roles").delete().eq("user_id", userId);

    // Finally remove the auth user so they cannot sign in with the same account
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("auth.admin.deleteUser failed", delErr);
      return json({ error: delErr.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("delete-organizer-account error", e);
    return json({ error: (e as Error).message || "Internal error" }, 500);
  }
});