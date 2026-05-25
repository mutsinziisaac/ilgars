import { useEffect, useReducer } from "react"
import { useMapsLibrary } from "@vis.gl/react-google-maps"

const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

function pickPlaceName(result: google.maps.GeocoderResult): string {
  const components = result.address_components ?? []
  const find = (type: string) =>
    components.find((c) => c.types.includes(type))?.long_name

  const locality =
    find("locality") ||
    find("sublocality") ||
    find("administrative_area_level_2") ||
    find("administrative_area_level_3")
  const region = find("administrative_area_level_1")

  if (locality && region && locality !== region) return `${locality}, ${region}`
  if (locality) return locality
  if (region) return region
  return result.formatted_address
}

export function reverseGeocode(
  geocoder: google.maps.Geocoder,
  lat: number,
  lng: number
): Promise<string | null> {
  const key = cacheKey(lat, lng)
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)

  const pending = inflight.get(key)
  if (pending) return pending

  const promise = geocoder
    .geocode({ location: { lat, lng } })
    .then((response) => {
      const result = response.results[0]
      if (!result) return null
      const name = pickPlaceName(result)
      cache.set(key, name)
      return name
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, promise)
  return promise
}

export function useReverseGeocode(
  lat: number | null,
  lng: number | null,
  enabled: boolean
): { place: string | null } {
  const geocodingLib = useMapsLibrary("geocoding")
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  const key = lat != null && lng != null ? cacheKey(lat, lng) : null

  useEffect(() => {
    if (!enabled || !key || !geocodingLib || cache.has(key)) return
    let cancelled = false
    const geocoder = new geocodingLib.Geocoder()
    reverseGeocode(geocoder, lat!, lng!).then(() => {
      if (cancelled) return
      forceUpdate()
    })
    return () => {
      cancelled = true
    }
  }, [enabled, key, geocodingLib, lat, lng])

  return { place: key ? cache.get(key) ?? null : null }
}
