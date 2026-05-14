import { useEffect } from "react"
import L from "leaflet"
import { MapContainer, Polyline, TileLayer, useMap } from "react-leaflet"

import { cn } from "@/lib/utils"

type PermitMapProps = {
  segment: [number, number][]
  className?: string
  emptyLabel?: string
  interactive?: boolean
}

const SEGMENT_COLOR = "#1f3a2a"

function FitBounds({ segment }: { segment: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (segment.length === 0) return
    const bounds = L.latLngBounds(
      segment.map(([lat, lng]) => L.latLng(lat, lng))
    )
    map.fitBounds(bounds, { padding: [18, 18], animate: false })
  }, [map, segment])
  return null
}

export function PermitMap({
  segment,
  className,
  emptyLabel,
  interactive = false,
}: PermitMapProps) {
  const center: [number, number] = segment[0] ?? [-25.9655, 32.5832]

  if (segment.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-muted/30 px-6 text-center text-sm text-muted-foreground",
          className
        )}
      >
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <MapContainer
        center={center}
        zoom={15}
        zoomControl={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        dragging={interactive}
        touchZoom={interactive}
        boxZoom={interactive}
        keyboard={interactive}
        attributionControl={interactive}
        className="permit-map h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains={["a", "b", "c"]}
          maxZoom={19}
          crossOrigin
        />
        <Polyline
          positions={segment}
          pathOptions={{
            color: SEGMENT_COLOR,
            weight: 4,
            opacity: 0.95,
            dashArray: "4 7",
            lineCap: "round",
            lineJoin: "round",
          }}
        />
        <FitBounds segment={segment} />
      </MapContainer>
    </div>
  )
}
