import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { isGoogleMapsConfigured } from "@/lib/google-maps"

type GoogleMapsBoundaryProps = {
  children: React.ReactNode
  className?: string
}

export function GoogleMapsBoundary({
  children,
  className,
}: GoogleMapsBoundaryProps) {
  const { t } = useTranslation()

  if (!isGoogleMapsConfigured()) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-muted/30 px-6 text-center text-sm text-muted-foreground",
          className
        )}
      >
        {t("maps.notConfigured")}
      </div>
    )
  }

  return <>{children}</>
}
