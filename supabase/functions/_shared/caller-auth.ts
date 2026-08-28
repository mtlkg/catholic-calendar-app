// Cryptographically-verified caller checks for Edge Functions.
// Never trusts unverified JWT payload claims.

import { createClient } from "npm:@supabase/supabase-js@2";

const bearer = (req: Request): string | null => {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
};

const projectApiKeys = (): string[] => {
  const keys: string[] = [];
  for (const name of ["SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS"]) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    for (const k of raw.split(",")) {
      const v = k.trim();
      if (v) keys.push(v);
    }
  }
  return keys;
};

/** True only when the request carries the project's service_role secret key. */
export function isServiceRoleCaller(req: Request): boolean {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) return false;
  const token = bearer(req) ?? req.headers.get("apikey");
  return !!token && token === secret;
}

/** Verifies a real signed user JWT and returns the user id, or null. */
export async function verifiedUserId(req: Request): Promise<string | null> {
  const token = bearer(req);
  if (!token) return null;
  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!.split(",")[0].trim(),
    );
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

/** True when the request presents a valid project publishable/anon API key. */
export function hasProjectApiKey(req: Request): boolean {
  const candidates = [req.headers.get("apikey"), bearer(req)].filter(Boolean) as string[];
  const keys = projectApiKeys();
  return candidates.some((c) => keys.includes(c));
}
