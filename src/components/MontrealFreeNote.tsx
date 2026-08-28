import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDiocese } from "@/context/DioceseContext";
import { UNLOCKED_CITY } from "@/data/dioceses";

/**
 * Free-access notice shown ONLY while a Montréal, QC diocese (or the combined
 * Montréal city view) is active. Organizers in these dioceses use verified
 * status at no cost; everywhere else the subscription applies.
 */
export default function MontrealFreeNote({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const { diocese } = useDiocese();

  if (diocese.city !== UNLOCKED_CITY) return null;

  return (
    <div
      className={`rounded-xl border border-gold/50 bg-gradient-to-r from-gold/12 via-ivory to-gold/12 px-3.5 py-2.5 flex items-start gap-2.5 ${className}`}
    >
      <span className="shrink-0 w-6 h-6 rounded-full bg-crimson/10 flex items-center justify-center mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-crimson" />
      </span>
      <p className="text-[12.5px] leading-snug font-body text-charcoal/80">
        <span className="font-bold text-charcoal">{t("montrealFree.title")}</span>{" "}
        {t("montrealFree.body")}
      </p>
    </div>
  );
}
