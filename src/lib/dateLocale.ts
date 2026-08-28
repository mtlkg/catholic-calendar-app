import { format as dfFormat } from "date-fns";
import { enUS, es, fr } from "date-fns/locale";
import i18n from "@/i18n";

export function getDateLocale(lang?: string) {
  const l = (lang || i18n.language || "en").toLowerCase();
  if (l.startsWith("fr")) return fr;
  if (l.startsWith("es")) return es;
  return enUS;
}

/**
 * Drop-in replacement for date-fns `format` that automatically uses the
 * currently-active i18n locale (English or French). Components that already
 * consume `useTranslation()` re-render on language change, so the output
 * updates accordingly.
 */
export function format(date: Date | number, fmt: string) {
  return dfFormat(date, fmt, { locale: getDateLocale() });
}
