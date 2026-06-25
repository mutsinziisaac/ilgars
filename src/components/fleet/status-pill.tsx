import { cn } from "@/lib/utils"

type Tone = "compliant" | "renewal-soon" | "trip" | "neutral" | "warning" | "critical"

const TONE_CLASSES: Record<Tone, string> = {
  compliant: "bg-chart-1/60 text-primary",
  "renewal-soon": "bg-accent text-accent-foreground",
  trip: "bg-amber-100 text-amber-800",
  neutral: "bg-muted text-muted-foreground",
  warning: "bg-accent text-secondary",
  critical: "bg-destructive/10 text-destructive",
}

const DOT_CLASSES: Record<Tone, string> = {
  compliant: "bg-primary",
  "renewal-soon": "bg-secondary",
  trip: "bg-amber-500",
  neutral: "bg-muted-foreground/60",
  warning: "bg-secondary",
  critical: "bg-destructive",
}

export function StatusPill({
  tone,
  children,
  withDot = true,
  className,
}: {
  tone: Tone
  children: React.ReactNode
  withDot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        TONE_CLASSES[tone],
        className
      )}
    >
      {withDot && <span className={cn("size-1.5 rounded-full", DOT_CLASSES[tone])} />}
      {children}
    </span>
  )
}
