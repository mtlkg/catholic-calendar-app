import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { DIOCESES, UNLOCKED_CITY } from "@/data/dioceses";

/**
 * Shown to approved organizers who have not yet paid for verified status.
 * Montréal, QC organizers are free for their first year, so they are exempt.
 */
export default function VerifiedPaymentBanner({ user }: { user: User }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const email = (user.email || "").toLowerCase();
    if (email === "globalcatholiccalendar@gmail.com") { setShow(false); return; }
    let cancelled = false;
    (async () => {
      const [{ data: paying }, { data: prof }] = await Promise.all([
        (supabase as any).rpc("is_paying_verified", { _user_id: user.id }),
        supabase
          .from("organizer_profiles")
          .select("status,diocese_slug")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const approved = (prof as any)?.status === "approved";
      const city = DIOCESES.find((d) => d.slug === (prof as any)?.diocese_slug)?.city;
      setShow(approved && !paying && city !== UNLOCKED_CITY);
    })();
    return () => { cancelled = true; };
  }, [user.id, user.email]);

  if (!show) return null;

  return (
    <div className="mb-6 rounded-xl border border-crimson/40 bg-crimson/5 p-4 flex items-start gap-3">
      <span className="shrink-0 w-8 h-8 rounded-full bg-crimson/10 flex items-center justify-center">
        <BadgeCheck className="w-4 h-4 text-crimson" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg text-charcoal">{t("verifiedPayment.title")}</p>
        <p className="text-sm text-charcoal/75 mt-0.5">{t("verifiedPayment.body")}</p>
        <Link
          to="/catholic-calendar/subscribe"
          className="inline-block mt-3 px-4 py-2 rounded-md bg-crimson text-ivory text-xs font-bold hover:bg-crimson-deep"
        >
          {t("verifiedPayment.cta")}
        </Link>
      </div>
    </div>
  );
}
