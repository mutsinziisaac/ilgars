import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"
import { en } from "./locales/en"
import { ptMZ } from "./locales/pt-MZ"

export const APP_LOCALES = ["en", "pt-MZ"] as const
export type AppLocale = (typeof APP_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = "en"
export const LANGUAGE_STORAGE_KEY = "ilgars-language"
export const LANGUAGE_CHANGE_EVENT = "ilgars-language-change"

export const LOCALE_OPTIONS: {
  value: AppLocale
  labelKey: "language.english" | "language.portuguese"
  shortLabelKey: "language.shortEnglish" | "language.shortPortuguese"
}[] = [
  {
    value: "en",
    labelKey: "language.english",
    shortLabelKey: "language.shortEnglish",
  },
  {
    value: "pt-MZ",
    labelKey: "language.portuguese",
    shortLabelKey: "language.shortPortuguese",
  },
]

export function normalizeLocale(value: unknown): AppLocale {
  if (typeof value !== "string") return DEFAULT_LOCALE
  const normalized = value.toLowerCase().replace("_", "-")
  if (normalized === "pt" || normalized.startsWith("pt-")) return "pt-MZ"
  return "en"
}

export function persistLocale(locale: AppLocale) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale)
}

export function syncLocale(locale: AppLocale) {
  persistLocale(locale)
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale
  }
}

export function applyLocale(locale: AppLocale) {
  syncLocale(locale)
  void i18n.changeLanguage(locale)
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      "pt-MZ": { translation: ptMZ },
    },
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: APP_LOCALES,
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
      convertDetectedLanguage: (lng) => normalizeLocale(lng),
    },
  })
  .then(() => {
    const locale = normalizeLocale(i18n.resolvedLanguage ?? i18n.language)
    syncLocale(locale)
  })

i18n.on("languageChanged", (language) => {
  const locale = normalizeLocale(language)
  syncLocale(locale)
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: { locale } })
    )
  }
})

export { i18n }
