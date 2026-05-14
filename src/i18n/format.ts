import { format as formatDateFns } from "date-fns"
import { enUS, pt } from "date-fns/locale"
import { i18n, normalizeLocale, type AppLocale } from "@/i18n"

const DATE_FNS_LOCALE: Record<AppLocale, typeof enUS> = {
  en: enUS,
  "pt-MZ": pt,
}

const INTL_LOCALE: Record<AppLocale, string> = {
  en: "en-US",
  "pt-MZ": "pt-MZ",
}

export function currentLocale(): AppLocale {
  return normalizeLocale(i18n.resolvedLanguage ?? i18n.language)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE[currentLocale()]).format(value)
}

export function formatCurrencyMzn(value: number): string {
  return formatNumber(value)
}

export function formatDate(value: Date, pattern: string): string {
  return formatDateFns(value, pattern, {
    locale: DATE_FNS_LOCALE[currentLocale()],
  })
}

export function formatDateValue(value: string | Date, options: Intl.DateTimeFormatOptions): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat(INTL_LOCALE[currentLocale()], options).format(date)
}
