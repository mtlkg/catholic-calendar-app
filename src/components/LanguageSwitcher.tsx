import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

type Lang = "en" | "fr" | "es";

/**
 * Compact EN/FR/ES toggle. Persists choice in localStorage (via i18next-browser-languagedetector).
 * First-time visitors get their browser language auto-detected.
 */
export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { i18n } = useTranslation();
  const raw = (i18n.resolvedLanguage || i18n.language || "en").toLowerCase();
  const current: Lang = raw.startsWith("fr") ? "fr" : raw.startsWith("es") ? "es" : "en";

  const set = (lng: Lang) => {
    if (lng !== current) i18n.changeLanguage(lng);
  };

  const langs: Lang[] = ["en", "fr", "es"];

  return (
    <div
      className={`inline-flex items-center gap-0 sm:gap-0.5 rounded-full border border-gold/40 bg-ivory/80 px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-body ${className}`}
      role="group"
      aria-label="Language"
    >
      <Globe className="hidden sm:block w-3 h-3 text-charcoal/60 ml-1" aria-hidden />
      {langs.map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => set(lng)}
          className={`px-1 sm:px-1.5 py-0.5 rounded-full transition-colors ${
            current === lng ? "bg-crimson text-ivory font-bold" : "text-charcoal/70 hover:text-crimson"
          }`}
          aria-pressed={current === lng}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
