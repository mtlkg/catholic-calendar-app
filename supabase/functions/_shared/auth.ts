// Shared auth helpers for Edge Functions.
// Rejects requests that lack a valid Supabase JWT and, optionally, that are
// not from the service_role.

import { createClient } from "npm:@supabase/supabase-js@2";

export type CallerRole = "anon" | "authenticated" | "service_role";

export interface CallerInfo {
  role: CallerRole;
  userId: string | null;
  email: string | null;
}

const decodeJwtPayload = (jwt: string): Record<string, unknown> | null => {
  try {
    const [, payload] = jwt.split(".");
    if (!payload) return null;
    // atob handles base64; JWT uses base64url — add padding & translate chars.
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
};

export function getCallerInfo(req: Request): CallerInfo | null {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const role = ((payload as any).role ?? "anon") as CallerRole;
  return {
    role,
    userId: ((payload as any).sub as string) ?? null,
    email: ((payload as any).email as string) ?? null,
  };
}

export function requireServiceRole(req: Request): Response | null {
  const info = getCallerInfo(req);
  if (!info || info.role !== "service_role") {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

// Confirms the caller has admin role via the has_role() function.
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
