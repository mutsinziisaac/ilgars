import { useEffect, useReducer } from "react"

const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

type NominatimAddress = {
  road?: string
  pedestrian?: string
  neighbourhood?: string
  quarter?: string
  suburb?: string
  city_district?: string
  hamlet?: string
  village?: string
  town?: string
  city?: string
  municipality?: string
  county?: string
  state?: string
  region?: string
  [key: string]: string | undefined
}

type NominatimResponse = {
  display_name?: string
  name?: string
  address?: NominatimAddress
  error?: unknown
}

function pickPlaceName(data: NominatimResponse): string | null {
  const addr = data.address ?? {}

  // Finest-grained label for the point itself (a road, named POI, or a
  // neighbourhood) — this is what makes the result feel "local".
  const specific =
    data.name ||
    addr.road ||
    addr.pedestrian ||
    addr.neighbourhood ||
    addr.quarter ||
    addr.suburb ||
    addr.city_district ||
    addr.hamlet

  // Broader settlement that gives the specific label context.
  const place =
    addr.village ||
    addr.town ||
    addr.city ||
    addr.municipality ||
    addr.county ||
    addr.state ||
    addr.region

  if (specific && place && specific !== place) return `${specific}, ${place}`
  if (specific) return specific
  if (place) return place
  if (data.display_name) return data.display_name.split(",")[0]?.trim() || null
  return null
}

// Nominatim's usage policy allows at most one request per second. We serialize
// every lookup through a single queue and space request starts ~1.1s apart so
// bursts from the table/card views (one lookup per visible row) stay compliant.
const MIN_INTERVAL_MS = 1100
const queue: Array<() => void> = []
let processing = false

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function processQueue() {
  if (processing) return
  processing = true
  while (queue.length > 0) {
    const job = queue.shift()!
    job()
    await delay(MIN_INTERVAL_MS)
  }
  processing = false
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => task().then(resolve, reject))
    void processQueue()
  })
}

async function fetchPlaceName(
  lat: number,
  lng: number
): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse")
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lng))
  url.searchParams.set("zoom", "17")
  url.searchParams.set("accept-language", "en")

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) return null
  const data = (await response.json()) as NominatimResponse
  if (data.error) return null
  return pickPlaceName(data)
}

export function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  const key = cacheKey(lat, lng)
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)

  const pending = inflight.get(key)
  if (pending) return pending

  const promise = enqueue(() => fetchPlaceName(lat, lng))
    .catch(() => null)
    .then((name) => {
      if (name) cache.set(key, name)
      return name
    })
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
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  const key = lat != null && lng != null ? cacheKey(lat, lng) : null

  useEffect(() => {
    if (!enabled || !key || cache.has(key)) return
    let cancelled = false
    reverseGeocode(lat!, lng!).then(() => {
      if (cancelled) return
      forceUpdate()
    })
    return () => {
      cancelled = true
    }
  }, [enabled, key, lat, lng])

  return { place: key ? cache.get(key) ?? null : null }
}
