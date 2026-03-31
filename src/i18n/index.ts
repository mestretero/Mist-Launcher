import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import tr from "./locales/tr.json";
import en from "./locales/en.json";
import de from "./locales/de.json";
import es from "./locales/es.json";

export const LANGUAGES = [
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "es", name: "Español", flag: "🇪🇸" },
] as const;

const SUPPORTED_CODES = LANGUAGES.map(l => l.code);

/** Detect best language from system/browser */
function detectLanguage(): string {
  // Check localStorage for user preference
  const saved = localStorage.getItem("mist-language");
  if (saved && SUPPORTED_CODES.includes(saved as any)) return saved;

  // Detect from browser/system
  const systemLangs = navigator.languages || [navigator.language];
  for (const lang of systemLangs) {
    const code = lang.split("-")[0].toLowerCase();
    if (SUPPORTED_CODES.includes(code as any)) return code;
  }

  return "en"; // Fallback to English
}

i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
    de: { translation: de },
    es: { translation: es },
  },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

/** Change language and persist */
export function changeLanguage(code: string) {
  i18n.changeLanguage(code);
  localStorage.setItem("mist-language", code);
}

export default i18n;
