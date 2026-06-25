import { cn } from "@/lib/utils"

type Size = "sm" | "lg"

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 w-16",
  lg: "h-44 w-full",
}

// Brand-cohesive palette (Maputo RUC greens + cream) so the illustration reads as intentional, not a wireframe.
const COLORS = {
  cab: "#4F8C6B",
  cabEdge: "#3A6B50",
  cabDark: "#34624A",
  trailer: "#FCFAF4",
  trailerEdge: "#4F8C6B",
  seam: "#DCE7E0",
  highlight: "#EFF4EE",
  glass: "#CFE6DA",
  headlight: "#FBE3A0",
  tire: "#2E3A34",
  rim: "#5C6F65",
  hub: "#EAF1EC",
  bgTop: "#FBF7EC",
  bgBottom: "#EBF1E8",
  road: "#E6ECE1",
  shadow: "#2E3A34",
}

/**
 * A clean flat-design articulated truck (cab-over tractor + box trailer), drawn in the brand palette.
 * Wheel count follows the axle count; the front (steer) axle sits under the cab and the rest cluster under
 * the trailer rear, like a real semi. `hatched` paints a soft preview background (used in the large preview);
 * the small variant stays transparent so it sits on its container.
 */
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
  const wheelCount = Math.max(2, Math.min(7, Math.round(axles) || 4))
  // Steer axle under the cab; remaining axles right-aligned under the trailer rear.
  const rearCount = wheelCount - 1
  const rearStart = 98
  const rearSpacing = 12
  const wheelXs = [
    24,
    ...Array.from({ length: rearCount }, (_, i) => rearStart - i * rearSpacing),
  ]
  const bgId = `veh-bg-${size}`

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-md border border-border",
        hatched ? "bg-transparent" : "bg-muted/40",
        SIZE_CLASSES[size],
        className
      )}
    >
      <svg
        viewBox="0 0 120 60"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        aria-hidden
      >
        {hatched && (
          <defs>
            <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={COLORS.bgTop} />
              <stop offset="1" stopColor={COLORS.bgBottom} />
            </linearGradient>
          </defs>
        )}
        {hatched && (
          <>
            <rect x="0" y="0" width="120" height="60" fill={`url(#${bgId})`} />
            <rect x="0" y="50" width="120" height="10" fill={COLORS.road} />
          </>
        )}

        {/* Ground shadow */}
        <ellipse cx="62" cy="52" rx="50" ry="2.6" fill={COLORS.shadow} opacity="0.1" />

        {/* Wheels — drawn first so the body tucks over their upper halves */}
        {wheelXs.map((cx, i) => (
          <g key={i}>
            <circle cx={cx} cy="45" r="6" fill={COLORS.tire} />
            <circle cx={cx} cy="45" r="3.6" fill={COLORS.rim} />
            <circle cx={cx} cy="45" r="1.6" fill={COLORS.hub} />
          </g>
        ))}

        {/* Trailer */}
        <rect
          x="46"
          y="10"
          width="62"
          height="34"
          rx="3"
          fill={COLORS.trailer}
          stroke={COLORS.trailerEdge}
          strokeWidth="2"
        />
        <rect x="48" y="12" width="58" height="3" rx="1.5" fill={COLORS.highlight} />
        <line x1="66" y1="13" x2="66" y2="41" stroke={COLORS.seam} strokeWidth="1.2" />
        <line x1="84" y1="13" x2="84" y2="41" stroke={COLORS.seam} strokeWidth="1.2" />
        <line x1="100" y1="13" x2="100" y2="41" stroke={COLORS.seam} strokeWidth="1.2" />

        {/* Coupling between cab and trailer */}
        <rect x="43" y="36" width="5" height="8" rx="1" fill={COLORS.cabDark} />

        {/* Cab (cab-over tractor, facing left) */}
        <rect
          x="12"
          y="15"
          width="33"
          height="29"
          rx="4"
          fill={COLORS.cab}
          stroke={COLORS.cabEdge}
          strokeWidth="2"
        />
        {/* Windshield */}
        <rect
          x="15.5"
          y="18"
          width="15"
          height="11"
          rx="2.5"
          fill={COLORS.glass}
          stroke={COLORS.cabEdge}
          strokeWidth="0.8"
        />
        {/* Body crease */}
        <line x1="20" y1="33" x2="44" y2="33" stroke={COLORS.cabEdge} strokeWidth="0.8" opacity="0.55" />
        {/* Headlight + bumper + mirror */}
        <rect x="13.5" y="31" width="4" height="3" rx="1" fill={COLORS.headlight} />
        <rect x="12.5" y="38" width="6" height="6" rx="1.2" fill={COLORS.cabDark} />
        <rect x="10.2" y="20" width="2.4" height="4" rx="1" fill={COLORS.cabDark} />
      </svg>
    </div>
  )
}
