import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, X, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import CalendarLayout from "./CalendarLayout";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { isStripeConfigured } from "@/lib/stripe";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Subscribe() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<"verified_monthly" | "verified_yearly" | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      setUser(data.session.user);
      const { data: paying } = await (supabase as any).rpc("is_paying_verified", { _user_id: data.session.user.id });
      setIsPaying(!!paying);
    })();
  }, []);

  const handlePick = (p: "verified_monthly" | "verified_yearly") => {
    if (!user) {
      navigate("/catholic-calendar/auth?next=/catholic-calendar/subscribe");
      return;
    }
    setPlan(p);
  };


  return (
    <CalendarLayout>
      <PaymentTestModeBanner />
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link to="/catholic-calendar/dashboard" className="inline-flex items-center gap-1 text-sm text-charcoal/60 hover:text-crimson mb-6">
          <ArrowLeft className="w-4 h-4" /> {t("subscribe.back")}
        </Link>
        <h1 className="font-display text-3xl md:text-4xl mb-2">{t("subscribe.title")}</h1>
        <p className="text-charcoal/70 mb-8">{t("subscribe.subtitle")}</p>

        {isPaying && (
          <div className="mb-6 p-4 rounded-md border border-emerald-300 bg-emerald-50 text-sm text-emerald-900 flex items-center justify-between gap-3 flex-wrap">
            <span>{t("subscribe.alreadyPaying")}</span>
            <ManageBillingButton />
          </div>
        )}

        {!isStripeConfigured() && (
          <div className="mb-6 p-4 rounded-md border border-red-300 bg-red-50 text-sm text-red-800">
            {t("subscribe.notConfigured")}
          </div>
        )}

        {!plan ? (
          <Tabs defaultValue="plans" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-5">
              <TabsTrigger value="plans">{t("subscribe.plans")}</TabsTrigger>
              <TabsTrigger value="compare">{t("subscribe.included")}</TabsTrigger>
            </TabsList>
            <TabsContent value="plans">
              <div className="grid gap-4 md:grid-cols-2">
                <PlanCard
                  title={t("subscribe.monthly")}
                  price="$10"
                  cadence={t("subscribe.perMonth")}
                  perks={t("subscribe.perksMonthly", { returnObjects: true }) as string[]}
                  onPick={() => handlePick("verified_monthly")}
                  disabled={!isStripeConfigured()}
                />
                <PlanCard
                  title={t("subscribe.yearly")}
                  price="$100"
                  cadence={t("subscribe.perYear")}
                  highlight={t("subscribe.save")}
                  perks={t("subscribe.perksYearly", { returnObjects: true }) as string[]}
                  onPick={() => handlePick("verified_yearly")}
                  disabled={!isStripeConfigured()}
                />
              </div>
            </TabsContent>
            <TabsContent value="compare">
              <ComparisonTable />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="rounded-md border border-border bg-card p-4">
            <button
              onClick={() => setPlan(null)}
              className="text-xs text-charcoal/60 hover:text-crimson mb-3 inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {t("subscribe.changePlan")}
            </button>
            <StripeEmbeddedCheckout
              priceId={plan}
              customerEmail={user?.email}
              userId={user?.id}
              metadata={{ kind: "verified_subscription" }}
              returnUrl={`${window.location.origin}/catholic-calendar/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
            />
          </div>
        )}
      </div>
    </CalendarLayout>
  );
}

function PlanCard({
  title, price, cadence, perks, highlight, onPick, disabled,
}: {
  title: string; price: string; cadence: string; perks: string[]; highlight?: string;
  onPick: () => void; disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border-2 border-border bg-card p-5 flex flex-col">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-2xl">{title}</h3>
        {highlight && <span className="text-[10px] font-bold uppercase tracking-wider bg-gold text-charcoal px-2 py-0.5 rounded">{highlight}</span>}
      </div>
      <p className="mt-2"><span className="text-3xl font-bold text-crimson">{price}</span> <span className="text-sm text-charcoal/60">{cadence}</span></p>
      <ul className="mt-4 space-y-1.5 text-sm text-charcoal/80 flex-1">
        {perks.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> {p}
          </li>
        ))}
      </ul>
      <button
        onClick={onPick}
        disabled={disabled}
        className="mt-5 px-4 py-2 rounded-md bg-crimson text-ivory text-sm font-bold hover:bg-crimson-deep disabled:opacity-50"
      >
        {t("subscribe.choose", { plan: title })}
      </button>
    </div>
  );
}

function ManageBillingButton() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    setLoading(true);
    try {
      const { getStripeEnvironment } = await import("@/lib/stripe");
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/catholic-calendar/subscribe`,
        },
      });
      if (error || !(data as any)?.url) throw new Error(error?.message || "Could not open billing portal");
      window.open((data as any).url, "_blank", "noopener,noreferrer");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <button onClick={onClick} disabled={loading} className="px-3 py-1.5 text-xs font-bold rounded bg-emerald-700 text-ivory hover:bg-emerald-800 disabled:opacity-50">
      {loading ? t("subscribe.opening") : t("subscribe.manageBilling")}
    </button>
  );
}

function ComparisonTable() {
  const { t } = useTranslation();
  const rows: Array<{ label: string; free: string | boolean; verified: string | boolean }> = [
    { label: t("subscribe.compareRows.submissions"), free: t("subscribe.compareRows.submissionsFree"), verified: t("subscribe.compareRows.submissionsVerified") },
    { label: t("subscribe.compareRows.autoApproved"), free: false, verified: true },
    { label: t("subscribe.compareRows.verifiedBadge"), free: false, verified: true },
    { label: t("subscribe.compareRows.priority"), free: false, verified: true },
    { label: t("subscribe.compareRows.boost"), free: true, verified: true },
    { label: t("subscribe.compareRows.dms"), free: false, verified: true },
    { label: t("subscribe.compareRows.threads"), free: false, verified: true },
    { label: t("subscribe.compareRows.profile"), free: false, verified: true },
  ];

  const cell = (v: string | boolean) =>
    typeof v === "boolean" ? (
      v ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-charcoal/30 mx-auto" />
    ) : (
      <span className="text-charcoal/80">{v}</span>
    );

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-3 bg-ivory/60 text-xs font-bold uppercase tracking-wider text-charcoal/70">
        <div className="p-3">{t("subscribe.compareFeature")}</div>
        <div className="p-3 text-center">{t("subscribe.compareUnverified")}</div>
        <div className="p-3 text-center bg-crimson/10 text-crimson">{t("subscribe.compareVerified")}</div>
      </div>
      {rows.map((r, i) => (
        <div key={r.label} className={`grid grid-cols-3 text-sm items-center ${i % 2 ? "bg-background" : "bg-ivory/20"}`}>
          <div className="p-3 text-charcoal/80">{r.label}</div>
          <div className="p-3 text-center">{cell(r.free)}</div>
          <div className="p-3 text-center bg-crimson/5">{cell(r.verified)}</div>
        </div>
      ))}
      <div className="p-3 text-[11px] text-charcoal/55 border-t border-border">
        {t("subscribe.compareFootnote")}
      </div>
    </div>
  );
}
