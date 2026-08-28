import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function callerRole(req: Request): string {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    // Public, signed-out browser calls include the publishable key as `apikey`
    // but no Authorization bearer. The platform has already accepted the
    // request before this function runs, so treat that path as the anon role.
    return req.headers.get("apikey") ? "anon" : "none";
  }
  const token = auth.slice(7);
  if (token.split(".").length !== 3) {
    return req.headers.get("apikey") ? "anon" : "none";
  }
  try {
    const [, payload] = token.split(".");
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/") +
      "==".slice(0, (4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(b64)).role ?? "none";
  } catch { return req.headers.get("apikey") ? "anon" : "none"; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    // verify_jwt=true in config.toml guarantees a valid platform credential
    // (anon key, authenticated JWT, or service_role). Also require that the caller is
    // targeting a real approved calendar event that still needs coords —
    // this bounds abuse to the app's own event dataset instead of arbitrary
    // free-text geocoding at the app's expense.
    const role = callerRole(req);
    if (role !== "anon" && role !== "authenticated" && role !== "service_role") {
      return json({ error: "authentication required" }, 401);
    }
    const { address, eventId } = await req.json();
    if (!address || typeof address !== "string") {
      return json({ error: "address required" }, 400);
    }
    if (role !== "authenticated" && role !== "service_role" && eventId) {
      // If an anon caller provides an eventId, verify it references a real
      // approved event still missing coords. Anon calls without an eventId
      // (e.g. from the public submit form) are allowed so newly-submitted
      // guest events get lat/lng before the moderator ever sees them.
      if (typeof eventId !== "string") {
        return json({ error: "invalid eventId" }, 400);
      }
      const supa = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: ev } = await supa
        .from("calendar_events")
        .select("id, status, latitude")
        .eq("id", eventId)
        .maybeSingle();
      if (!ev || ev.status !== "approved" || ev.latitude != null) {
        return json({ error: "not eligible" }, 403);
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    // Server-side geocoding must use a non-referrer-restricted key. Try every
    // linked Maps server key so a working custom key is picked up automatically.
    const GMAPS_KEYS = [
      Deno.env.get("GOOGLE_MAPS_API_KEY"),
      Deno.env.get("GOOGLE_MAPS_API_KEY_1"),
      Deno.env.get("GOOGLE_MAPS_API_KEY_2"),
      Deno.env.get("GOOGLE_MAPS_API_KEY_3"),
    ].filter((key): key is string => Boolean(key));

    const geocode = async (query: string, mapsKey: string) => {
      const url =
        `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json` +
        `?address=${encodeURIComponent(query)}&region=ca`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": mapsKey,
        },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Geocode failed: ${res.status} ${body}`);
      }
      return await res.json();
    };

    // Keyless fallback so addresses still resolve when no Maps server key is
    // linked (otherwise events without coordinates vanish from radius filters).
    const geocodeOsm = async (query: string) => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "TheCatholicCalendar/1.0 (events geocoding)" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const hit = Array.isArray(data) ? data[0] : null;
      if (!hit) return null;
      const lat = Number(hit.lat), lng = Number(hit.lon);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    };

    const queries = Array.from(new Set([
      address,
      // If venue + address fails, retry the street address itself. Google can
      // return ZERO_RESULTS when the venue name and formatted street address
      // do not match exactly, even though the address alone is valid.
      address.includes(",") ? address.split(",").slice(1).join(",").trim() : "",
    ].filter((q) => q.length > 0)));

    let loc: { lat: number; lng: number } | null = null;
    if (LOVABLE_API_KEY && GMAPS_KEYS.length > 0) {
      for (const mapsKey of GMAPS_KEYS) {
        for (const query of queries) {
          try {
            const data = await geocode(query, mapsKey);
            const denied = data?.status === "REQUEST_DENIED";
            if (denied) break;
            loc = data?.results?.[0]?.geometry?.location ?? null;
          } catch (_) {
            loc = null;
          }
          if (loc) break;
        }
        if (loc) break;
      }
    }
    if (!loc) {
      for (const query of queries) {
        loc = await geocodeOsm(query);
        if (loc) break;
      }
    }
    if (!loc) return json({ point: null });


    const point = { lat: loc.lat, lng: loc.lng };

    // Best-effort: persist to the event row so we don't re-geocode next time.
    if (eventId && typeof eventId === "string") {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase
          .from("calendar_events")
          .update({ latitude: point.lat, longitude: point.lng })
          .eq("id", eventId)
          .or("latitude.is.null,longitude.is.null");
      } catch (_) {
        /* ignore persistence errors */
      }
    }

    return json({ point });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});