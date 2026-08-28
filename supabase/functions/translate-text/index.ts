import { isServiceRoleCaller, verifiedUserId } from "../_shared/caller-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Billed AI calls require a genuine caller: a signed-in user session or
    // the project's service_role key. A bare publishable/anon key is not enough.
    const allowed = isServiceRoleCaller(req) || (await verifiedUserId(req)) !== null;
    if (!allowed) {
      return new Response(JSON.stringify({ error: "authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }



    const { text, target } = await req.json();
    if (!text || typeof text !== "string" || !target) {
      return new Response(JSON.stringify({ error: "Missing text or target" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 5000) {
      return new Response(JSON.stringify({ error: "text too long (max 5000 chars)" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (target !== "en" && target !== "fr" && target !== "es") {
      return new Response(JSON.stringify({ error: "unsupported target" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langName = target === "fr" ? "French" : target === "es" ? "Spanish" : target === "en" ? "English" : target;
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the user's text into ${langName}, regardless of the source language. If any portion is already in ${langName}, keep it; translate everything else into ${langName} so the entire output is in ${langName}. Preserve formatting, line breaks, URLs, and proper nouns. Output ONLY the final ${langName} text — no explanations, no quotes, no source text, no notes.`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: "AI gateway error", detail: errText }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const translated = data.choices?.[0]?.message?.content?.trim() ?? text;
    return new Response(JSON.stringify({ translated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
