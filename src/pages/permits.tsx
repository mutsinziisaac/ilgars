import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { PermitCard } from "@/components/permits/permit-card"
import {
  permitStatusCounts,
  permitsByStatus,
  type PermitStatus,
} from "@/lib/permits"
import { cn } from "@/lib/utils"

type TabKey = PermitStatus | "all"

const TAB_ORDER: TabKey[] = [
  "all",
  "active",
  "pending-review",
  "awaiting-payment",
  "rejected",
  "completed",
]

export default function Permits() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabKey>("all")
  const counts = useMemo(() => permitStatusCounts(), [])
  const visible = useMemo(() => permitsByStatus(tab), [tab])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 border-b border-border">
        {TAB_ORDER.map((key) => {
          const isActive = tab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "relative -mb-px flex items-center gap-2 px-3 py-3 text-sm transition-colors",
                isActive
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{t(tabLabelKey(key))}</span>
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  isActive
                    ? "bg-sidebar text-sidebar-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {counts[key]}
              </span>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-sidebar"
                />
              )}
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 text-sm text-muted-foreground">
          {t("permits.noPermits")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((permit) => (
            <PermitCard key={permit.id} permit={permit} />
          ))}
        </div>
      )}
    </div>
  )
}

function tabLabelKey(key: TabKey) {
  if (key === "pending-review") return "permits.tabs.pendingReview"
  if (key === "awaiting-payment") return "permits.tabs.awaitingPayment"
  return `permits.tabs.${key}`
}
