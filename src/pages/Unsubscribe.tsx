import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://aupjftfltmepayoaduxr.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cGpmdGZsdG1lcGF5b2FkdXhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMDY1MTEsImV4cCI6MjA5MDU4MjUxMX0.DgsBaVnZGqp7e7rorHT5JPAd24xsU_d6FBA035Jkg7I";

type State = "loading" | "ready" | "already" | "invalid" | "success" | "error";

export default function Unsubscribe() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: ANON_KEY } },
        );
        const data = await res.json();
        if (data?.valid) setState("ready");
        else if (data?.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch { setState("error"); }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState("loading");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) { setState("error"); return; }
      if (data?.success) setState("success");
      else if (data?.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch { setState("error"); }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-ivory px-5">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center">
        <h1 className="font-display text-2xl text-crimson mb-3">{t("unsubscribe.title")}</h1>
        {state === "loading" && <p className="text-charcoal/60 text-sm">{t("unsubscribe.loading")}</p>}
        {state === "ready" && (
          <>
            <p className="text-charcoal/80 text-sm mb-5">{t("unsubscribe.ready")}</p>
            <button onClick={confirm} className="px-5 py-2.5 rounded-md bg-crimson text-ivory font-bold hover:bg-crimson-deep">
              {t("unsubscribe.confirm")}
            </button>
          </>
        )}
        {state === "success" && <p className="text-emerald-700 text-sm">{t("unsubscribe.success")}</p>}
        {state === "already" && <p className="text-charcoal/70 text-sm">{t("unsubscribe.already")}</p>}
        {state === "invalid" && <p className="text-destructive text-sm">{t("unsubscribe.invalid")}</p>}
        {state === "error" && <p className="text-destructive text-sm">{t("unsubscribe.error")}</p>}
      </div>
    </main>
  );
}
