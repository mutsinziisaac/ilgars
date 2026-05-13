import { cn } from "@/lib/utils"

type Size = "sm" | "lg"

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 w-16",
  lg: "h-44 w-full",
}

export function VehicleIllustration({
  axles,
  size = "sm",
  hatched = false,
  className,
}: {
  axles: number
  size?: Size
  hatched?: boolean
  className?: string
}) {
  const wheelSpacing = 9
  const baseX = 40 - ((axles - 1) * wheelSpacing) / 2
  const patternId = `hatch-${size}`

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-md border border-border",
        hatched ? "bg-secondary/10" : "bg-muted/40",
        SIZE_CLASSES[size],
        className
      )}
    >
      <svg
        viewBox="0 0 80 40"
        preserveAspectRatio={size === "lg" ? "xMidYMid meet" : "none"}
        className="h-full w-full"
        aria-hidden
      >
        {hatched && (
          <defs>
            <pattern
              id={patternId}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                className="stroke-secondary/25"
                strokeWidth="2"
              />
            </pattern>
          </defs>
        )}
        {hatched && <rect x="0" y="0" width="80" height="40" fill={`url(#${patternId})`} />}
        <rect
          x="6"
          y="8"
          width="68"
          height="20"
          rx="3"
          className="fill-card stroke-primary/70"
          strokeWidth="1.2"
        />
        <line
          x1="22"
          y1="8"
          x2="22"
          y2="28"
          className="stroke-primary/60"
          strokeWidth="1"
        />
        {Array.from({ length: axles }).map((_, i) => (
          <circle
            key={i}
            cx={baseX + i * wheelSpacing}
            cy={32}
            r={2.5}
            className="fill-card stroke-primary/70"
            strokeWidth="1.2"
          />
        ))}
      </svg>
    </div>
  )
}
