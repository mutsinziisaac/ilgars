import { useEffect, useState } from "react"

import { useTheme } from "@/components/theme-provider"

export const GOOGLE_MAPS_API_KEY: string =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? ""

export function isGoogleMapsConfigured(): boolean {
  return GOOGLE_MAPS_API_KEY.length > 0
}

export const UGANDA_CENTER = { lat: 1.3733, lng: 32.2903 }
export const UGANDA_OVERVIEW_ZOOM = 7
export const UGANDA_BOUNDS = {
  latLngBounds: { south: -1.6, west: 29.4, north: 4.4, east: 35.1 },
  strictBounds: true,
} as const

export const MAPUTO_CENTER = { lat: -25.9655, lng: 32.5832 }

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"

export type ResolvedMapTheme = "light" | "dark"

export function useResolvedTheme(): ResolvedMapTheme {
  const { theme } = useTheme()
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia(COLOR_SCHEME_QUERY).matches
  })

  useEffect(() => {
    if (theme !== "system") return
    const media = window.matchMedia(COLOR_SCHEME_QUERY)
    const handle = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches)
    }
    media.addEventListener("change", handle)
    return () => media.removeEventListener("change", handle)
  }, [theme])

  if (theme === "dark") return "dark"
  if (theme === "light") return "light"
  return systemPrefersDark ? "dark" : "light"
}

export const lightMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f0efe7" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#2d3436" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f8f8f6" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#c9c4b5" }],
  },
  {
    featureType: "administrative.country",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3f4a45" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3f4a45" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#e8e6da" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry",
    stylers: [{ color: "#f0efe7" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#e2e4d6" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#5d6b62" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#d8e0cf" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4f6a55" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e0dbc9" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#5d6b62" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#fbfaf4" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#f5e9b7" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#d9c879" }],
  },
  {
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [{ color: "#cdd3c4" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#2ba89f" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#d9e2d7" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7a8c80" }],
  },
]

export const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#2d3436" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#f0f0f0" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#22272a" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#4a5258" }],
  },
  {
    featureType: "administrative.country",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cfd4d6" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cfd4d6" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#262b2d" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry",
    stylers: [{ color: "#2d3436" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#2f3739" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9aa3a0" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#2a3631" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#a8c5b0" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#3a4045" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#22272a" }] ,
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#c0c7c4" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#3f464b" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#4a4628" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#22272a" }],
  },
  {
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [{ color: "#3a4045" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#c4d000" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#1b1f22" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7a8c80" }],
  },
]

export function getMapStyles(
  theme: ResolvedMapTheme
): google.maps.MapTypeStyle[] {
  return theme === "dark" ? darkMapStyles : lightMapStyles
}

