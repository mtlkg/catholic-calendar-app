import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import fr from "./fr.json";
import es from "./es.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "fr", "es"],
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nLang",
    },
    interpolation: { escapeValue: false },
  });

// Keep <html lang> in sync so screen readers / SEO know the current language.
const applyLang = (lng: string) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng.startsWith("fr") ? "fr" : lng.startsWith("es") ? "es" : "en";
  }
};
applyLang(i18n.language || "en");
i18n.on("languageChanged", applyLang);

export default i18n;
