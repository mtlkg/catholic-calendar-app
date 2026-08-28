import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import CalendarLayout from "./CalendarLayout";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const { t } = useTranslation();
  const sessionId = params.get("session_id");
  return (
    <CalendarLayout>
      <div className="max-w-lg mx-auto px-5 py-16 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
        <h1 className="font-display text-3xl mb-2">{t("checkoutReturn.thankYou")}</h1>
        <p className="text-charcoal/70 mb-6">{t("checkoutReturn.processing")}</p>
        {sessionId && (
          <p className="text-[10px] text-charcoal/30 font-mono mb-6">
            {t("checkoutReturn.ref")} {sessionId.slice(0, 24)}…
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <Link to="/catholic-calendar/dashboard" className="px-4 py-2 rounded-md bg-crimson text-ivory text-sm font-bold hover:bg-crimson-deep">
            {t("checkoutReturn.goDashboard")}
          </Link>
          <Link to="/catholic-calendar" className="px-4 py-2 rounded-md border border-border text-sm">
            {t("checkoutReturn.backCalendar")}
          </Link>
        </div>
      </div>
    </CalendarLayout>
  );
}
