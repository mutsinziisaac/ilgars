import { Button } from "@/components/ui/button"
import { formatMzn } from "@/lib/fleet"
import {
  formatPermitSchedule,
  PERMIT_CATEGORY_LABELS,
  PERMIT_STATUS_LABELS,
  ROAD_CLASS_LABELS,
  type Permit,
  type PermitStatus,
} from "@/lib/permits"
import { cn } from "@/lib/utils"

import { PermitMap } from "./permit-map"

const STATUS_PILL_CLASSES: Record<PermitStatus, string> = {
  active: "bg-sidebar text-sidebar-foreground",
  "awaiting-payment": "bg-accent text-amber-700",
  "pending-review": "bg-sky-100 text-sky-800",
  rejected: "bg-destructive/10 text-destructive",
  completed: "bg-muted text-muted-foreground",
}

function StatusPill({ status }: { status: PermitStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        STATUS_PILL_CLASSES[status]
      )}
    >
      {status === "active" && (
        <span className="flex size-3 items-center justify-center rounded-full border border-sidebar-foreground/40">
          <span className="size-1.5 rounded-full bg-sidebar-foreground" />
        </span>
      )}
      {PERMIT_STATUS_LABELS[status]}
    </span>
  )
}

function PermitAction({ status }: { status: PermitStatus }) {
  if (status === "awaiting-payment") {
    return (
      <Button
        size="sm"
        className="h-9 rounded-full bg-sidebar px-5 text-sidebar-foreground hover:bg-sidebar/90"
      >
        Pay now
      </Button>
    )
  }

  const label = status === "completed" ? "View receipt" : "View details"
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 rounded-full px-5"
    >
      {label}
    </Button>
  )
}

export function PermitCard({ permit }: { permit: Permit }) {
  const isActive = permit.status === "active"
  const title = `${PERMIT_CATEGORY_LABELS[permit.category]} · ${permit.road}`
  const rateLabel = `${ROAD_CLASS_LABELS[permit.roadClass].toUpperCase()} · ${formatMzn(permit.hourlyRateMzn)} MZN/H`

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {isActive && (
        <span
          aria-hidden
          className="absolute top-0 right-0 left-0 z-[1] h-1 bg-sidebar"
        />
      )}
      <div className="relative h-36 w-full">
        <PermitMap segment={permit.segment} />
        <div className="pointer-events-none absolute top-3 left-3 z-[1]">
          <StatusPill status={permit.status} />
        </div>
      </div>

      <div className="flex flex-col gap-1 px-5 pt-4 pb-3">
        <p className="text-[11px] tracking-wider text-muted-foreground">
          {permit.id}
        </p>
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {formatPermitSchedule(permit)}
        </p>
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-border px-5 py-3.5">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            {rateLabel}
          </p>
          <p className="text-lg font-semibold tracking-tight text-foreground">
            {formatMzn(permit.totalMzn)}
            <span className="ml-1.5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              MZN
            </span>
          </p>
        </div>
        <PermitAction status={permit.status} />
      </div>
    </article>
  )
}
