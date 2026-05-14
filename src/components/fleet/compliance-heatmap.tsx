import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import type { ComplianceCellState } from "@/lib/fleet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const STATE_FILL: Record<ComplianceCellState, string> = {
  paid: "fill-primary",
  idle: "fill-muted",
  alert: "fill-secondary",
}

const MONTH_LABELS = [
  "May '25",
  "",
  "",
  "Aug",
  "",
  "",
  "Nov",
  "",
  "",
  "Feb '26",
  "",
  "",
  "May '26",
]

export function ComplianceHeatmap({
  series,
  className,
}: {
  series: ComplianceCellState[]
  className?: string
}) {
  const { t } = useTranslation()
  const counts = useMemo(() => {
    const c = { paid: 0, idle: 0, alert: 0 }
    for (const s of series) c[s] += 1
    return c
  }, [series])

  const cols = 53
  const rows = 7
  const cellSize = 12
  const gap = 3
  const width = cols * (cellSize + gap)
  const height = rows * (cellSize + gap)

  const cells: { x: number; y: number; state: ComplianceCellState; idx: number }[] =
    []
  for (let i = 0; i < series.length; i++) {
    const col = Math.floor(i / rows)
    const row = i % rows
    cells.push({
      x: col * (cellSize + gap),
      y: row * (cellSize + gap),
      state: series[i],
      idx: i,
    })
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {t("compliance.title")}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("compliance.description")}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <Legend swatch="bg-primary" label={t("compliance.paidCount", { count: counts.paid })} />
          <Legend swatch="bg-secondary" label={t("compliance.alertCount", { count: counts.alert })} />
          <Legend swatch="bg-muted" label={t("compliance.idleCount", { count: counts.idle })} />
        </div>
      </div>

      <TooltipProvider delayDuration={50}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-44 w-full"
          aria-label={t("compliance.aria")}
        >
          {cells.map((cell) => (
            <Tooltip key={cell.idx}>
              <TooltipTrigger asChild>
                <rect
                  x={cell.x}
                  y={cell.y}
                  width={cellSize}
                  height={cellSize}
                  rx={2}
                  className={cn(STATE_FILL[cell.state], "transition-opacity hover:opacity-80")}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {t("compliance.dayState", {
                  day: cell.idx + 1,
                  state: t(`compliance.${cell.state}`),
                })}
              </TooltipContent>
            </Tooltip>
          ))}
        </svg>
      </TooltipProvider>

      <div
        className="grid text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase"
        style={{ gridTemplateColumns: `repeat(${MONTH_LABELS.length}, minmax(0, 1fr))` }}
      >
        {MONTH_LABELS.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
    </div>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-sm", swatch)} aria-hidden />
      <span>{label}</span>
    </span>
  )
}
