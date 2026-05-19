import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps"

import { GoogleMapsBoundary } from "@/components/maps/google-maps-boundary"
import {
  MAPUTO_CENTER,
  getMapStyles,
  useResolvedTheme,
  type ResolvedMapTheme,
} from "@/lib/google-maps"
import { cn } from "@/lib/utils"

type PermitMapProps = {
  segment: [number, number][]
  className?: string
  emptyLabel?: string
  interactive?: boolean
}

function segmentColor(theme: ResolvedMapTheme) {
  return theme === "dark" ? "#c4d000" : "#2ba89f"
}

function RoutePolyline({
  segment,
  theme,
}: {
  segment: [number, number][]
  theme: ResolvedMapTheme
}) {
  const map = useMap()
  const mapsLib = useMapsLibrary("maps")

  useEffect(() => {
    if (!map || !mapsLib || segment.length === 0) return

    const color = segmentColor(theme)
    const path = segment.map(([lat, lng]) => ({ lat, lng }))

    const casing = new mapsLib.Polyline({
      map,
      path,
      strokeColor: theme === "dark" ? "#0c1410" : "#ffffff",
      strokeOpacity: 0.9,
      strokeWeight: 8,
    })

    const route = new mapsLib.Polyline({
      map,
      path,
      strokeColor: color,
      strokeOpacity: 1,
      strokeWeight: 5,
    })

    return () => {
      casing.setMap(null)
      route.setMap(null)
    }
  }, [map, mapsLib, segment, theme])

  return null
}

function FitBounds({
  segment,
  padding,
}: {
  segment: [number, number][]
  padding: number
}) {
  const map = useMap()
  const coreLib = useMapsLibrary("core")

  useEffect(() => {
    if (!map || !coreLib || segment.length === 0) return

    if (segment.length === 1) {
      map.setCenter({ lat: segment[0][0], lng: segment[0][1] })
      return
    }

    const bounds = new coreLib.LatLngBounds()
    segment.forEach(([lat, lng]) => bounds.extend({ lat, lng }))
    map.fitBounds(bounds, padding)
  }, [map, coreLib, segment, padding])

  return null
}

export function PermitMap({
  segment,
  className,
  emptyLabel,
  interactive = false,
}: PermitMapProps) {
  const { t } = useTranslation()
  const theme = useResolvedTheme()

  if (segment.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-muted/30 px-6 text-center text-sm text-muted-foreground",
          className
        )}
      >
        {emptyLabel ?? t("permits.roadClosure.noRouteGeometry")}
      </div>
    )
  }

  const center = segment[0]
    ? { lat: segment[0][0], lng: segment[0][1] }
    : MAPUTO_CENTER

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <GoogleMapsBoundary>
        <Map
          key={theme}
          defaultCenter={center}
          defaultZoom={15}
          styles={getMapStyles(theme)}
          gestureHandling={interactive ? "auto" : "none"}
          disableDefaultUI={!interactive}
          zoomControl={interactive}
          keyboardShortcuts={interactive}
          clickableIcons={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          className="h-full w-full"
        >
          <RoutePolyline segment={segment} theme={theme} />
          <FitBounds segment={segment} padding={18} />
        </Map>
      </GoogleMapsBoundary>
    </div>
  )
}
