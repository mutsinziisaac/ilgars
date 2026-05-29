import { Check, Languages } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LOCALE_OPTIONS, applyLocale, normalizeLocale } from "@/i18n"
import { cn } from "@/lib/utils"

type LanguageSwitcherProps = {
  variant?: "default" | "ghost"
  className?: string
}

export function LanguageSwitcher({
  variant = "default",
  className,
}: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation()
  const current = normalizeLocale(i18n.resolvedLanguage ?? i18n.language)
  const active = LOCALE_OPTIONS.find((option) => option.value === current)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("language.select")}
          className={cn(
            "h-9 gap-1.5 rounded-lg px-2.5 text-xs font-semibold tracking-wide uppercase max-lg:h-11",
            variant === "ghost" && "border-transparent bg-transparent",
            className
          )}
        >
          <Languages className="size-3.5" />
          {active ? t(active.shortLabelKey) : current.toUpperCase()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {LOCALE_OPTIONS.map((option) => {
          const isActive = option.value === current
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => {
                if (option.value !== current) applyLocale(option.value)
              }}
              className="flex items-center justify-between gap-2"
            >
              <span>{t(option.labelKey)}</span>
              {isActive && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
