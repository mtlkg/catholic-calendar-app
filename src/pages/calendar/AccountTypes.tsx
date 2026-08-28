import { Link } from "react-router-dom";
import { Check, X, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import CalendarLayout from "./CalendarLayout";
import MontrealFreeNote from "@/components/MontrealFreeNote";

export default function AccountTypes() {
  const { t } = useTranslation();

  const rows: Array<{ label: string; free: string | boolean; verified: string | boolean }> = [
    { label: t("accounts.rows.submissions"), free: t("accounts.rows.submissionsFree"), verified: t("accounts.rows.submissionsVerified") },
    { label: t("accounts.rows.autoApproved"), free: false, verified: true },
    { label: t("accounts.rows.verifiedBadge"), free: false, verified: true },
    { label: t("accounts.rows.priority"), free: false, verified: true },
    { label: t("accounts.rows.profile"), free: false, verified: true },
    { label: t("accounts.rows.followers"), free: false, verified: true },
    { label: t("accounts.rows.seeInterested"), free: false, verified: true },
    { label: t("accounts.rows.dms"), free: false, verified: true },
    { label: t("accounts.rows.threads"), free: false, verified: true },
    { label: t("accounts.rows.recurringEvents"), free: false, verified: true },
    { label: t("accounts.rows.broadcastEvents"), free: false, verified: true },
    { label: t("accounts.rows.promoVideo"), free: false, verified: true },
    { label: t("accounts.rows.followerNotify"), free: false, verified: true },
    { label: t("accounts.rows.pushNotify"), free: false, verified: true },
    { label: t("accounts.rows.edit"), free: t("accounts.rows.editFree"), verified: t("accounts.rows.editVerified") },
  ];

  const cell = (v: string | boolean) => {
    if (typeof v === "boolean") {
      return v
        ? <Check className="w-4 h-4 text-emerald-600 mx-auto" />
        : <X className="w-4 h-4 text-charcoal/30 mx-auto" />;
    }
    return <span className="text-charcoal/80 text-xs md:text-sm">{v}</span>;
  };

  return (
    <CalendarLayout>
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link
          to="/catholic-calendar"
          className="inline-flex items-center gap-1 text-sm text-charcoal/60 hover:text-crimson mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> {t("accounts.back")}
        </Link>

        <h1 className="font-display text-3xl md:text-4xl mb-2">{t("accounts.title")}</h1>
        <p className="text-charcoal/70 mb-6">{t("accounts.subtitle")}</p>

        <MontrealFreeNote className="mb-6" />



        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-3 bg-ivory/60 text-[11px] md:text-xs font-bold uppercase tracking-wider text-charcoal/70">
            <div className="p-3">{t("accounts.feature")}</div>
            <div className="p-3 text-center">{t("accounts.unverified")}</div>
            <div className="p-3 text-center bg-crimson/10 text-crimson">{t("accounts.verified")}</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`grid grid-cols-3 text-sm items-center ${i % 2 ? "bg-background" : "bg-ivory/20"}`}
            >
              <div className="p-3 text-charcoal/80 text-xs md:text-sm">{r.label}</div>
              <div className="p-3 text-center">{cell(r.free)}</div>
              <div className="p-3 text-center bg-crimson/5">{cell(r.verified)}</div>
            </div>
          ))}
        </div>

        {/* Verified pricing — under the feature list */}
        <div className="mt-6 rounded-xl border border-crimson/30 bg-card overflow-hidden">
          <div className="px-4 py-2.5 bg-crimson/8 border-b border-crimson/20">
            <p className="font-display text-base md:text-lg text-charcoal">{t("accounts.pricing.title")}</p>
            <p className="text-[11px] text-charcoal/65 mt-0.5">{t("accounts.pricing.subtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
            <div className="p-3.5">
              <p className="text-[11px] uppercase tracking-widest text-charcoal/50 font-bold">
                {t("accounts.pricing.monthly")}
              </p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-crimson">$10 USD</span>
                <span className="text-xs text-charcoal/60">{t("accounts.pricing.perMonth")}</span>
              </p>
            </div>
            <div className="p-3.5">
              <p className="text-[11px] uppercase tracking-widest text-charcoal/50 font-bold">
                {t("accounts.pricing.yearly")}
              </p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-crimson">$100 USD</span>
                <span className="text-xs text-charcoal/60">{t("accounts.pricing.perYear")}</span>
              </p>
              <p className="text-[11px] text-charcoal/55 mt-1">{t("accounts.pricing.saveNote")}</p>
            </div>
          </div>
          <div className="px-4 py-2 text-[11px] text-charcoal/55 border-t border-border">
            {t("accounts.pricing.footnote")}
          </div>
        </div>



        <div className="mt-6 rounded-md border border-gold/40 bg-gold/5 p-4 text-sm text-charcoal/80">
          <p className="font-bold text-charcoal mb-1">{t("accounts.howVerified")}</p>
          <p className="mb-3">{t("accounts.howVerifiedBody")}</p>
          <Link
            to="/catholic-calendar/auth?mode=signup"
            className="inline-block px-4 py-2 rounded-md bg-crimson text-ivory text-xs font-bold hover:bg-crimson-deep"
          >
            {t("accounts.createAccount")}
          </Link>
        </div>
      </div>
    </CalendarLayout>
  );
}
