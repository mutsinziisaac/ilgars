import { apiRequest, resolveApiBaseUrl } from "@/lib/api"

const CORE_API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  "/core/api/v1"
)

export const MUNICIPALITY_ID = (
  import.meta.env.VITE_MUNICIPALITY_ID ?? ""
).trim()

export type TripCreatePayload = {
  vehicleId: string
  municipalityId: string
  paymentMode: "PREPAID"
  expectedDurationDays: number
  createdBy?: string
  reason?: string
  routeId?: string
}

export type VehicleTrip = {
  billingStatus: string
  createdBy: string
  creationSource: string
  expectedDurationDays: number
  feeCount: number
  id: string
  municipalityId: string
  outstandingFeeAmount: number
  paidFeeAmount: number
  paymentMode: string
  reason: string
  status: string
  totalFeeAmount: number
  vehicleId: string
  [key: string]: unknown
}

export type TripInvoice = {
  id?: string
  amount?: number
  totalAmount?: number
  currency?: string
  durationDays?: number
  lines?: unknown[]
  prn?: string
  status?: string
  [key: string]: unknown
}

export type TripFee = {
  id?: string
  amount?: number
  totalAmount?: number
  status?: string
  [key: string]: unknown
}

export type TripCreateResult = {
  trip: VehicleTrip
  fee: TripFee | null
  invoice: TripInvoice | null
  specialPermit: unknown | null
}

export type MunicipalRoute = {
  id: string
  routeName?: string
  name?: string
  routeCode?: string
  allowedUse?: string
  active?: boolean
  geoJson?: string
  [key: string]: unknown
}

export type SpecialPermitRouteRequestPayload = {
  vehicleId: string
  municipalityId: string
  paymentMode: "PREPAID"
  expectedDurationDays: number
  routeName: string
  routeGeoJson: {
    type: "Feature"
    geometry: {
      type: "LineString"
      coordinates: [number, number][]
    }
    properties: { name: string }
  }
  requestedBy: string
  notes?: string
}

export type SpecialPermitRouteRequest = {
  id: string
  status: string
  vehicleId: string
  municipalityId: string
  paymentMode: string
  expectedDurationDays: number
  routeName: string
  [key: string]: unknown
}

type Wrapped<T> = T | { data: T }

function unwrap<T>(response: Wrapped<T>): T {
  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    (response as { data?: T }).data !== undefined
  ) {
    return (response as { data: T }).data
  }
  return response as T
}

export function getTripsByVehicleId(vehicleId: string) {
  return apiRequest<VehicleTrip[]>(
    `${CORE_API_BASE_URL}/trips?vehicleId=${encodeURIComponent(vehicleId)}`
  )
}

export async function createTrip(payload: TripCreatePayload) {
  const response = await apiRequest<Wrapped<TripCreateResult>>(
    `${CORE_API_BASE_URL}/trips`,
    {
      method: "POST",
      body: { data: payload },
    }
  )
  return unwrap(response)
}

export const createPrepaidTrip = createTrip

export async function createPublicPrepaidTrip(payload: TripCreatePayload) {
  const response = await apiRequest<Wrapped<TripCreateResult>>(
    `${CORE_API_BASE_URL}/public/prepaid-trips`,
    {
      method: "POST",
      body: { data: payload },
      skipAuth: true,
    }
  )
  return unwrap(response)
}

export async function getTripDetail(tripId: string) {
  const response = await apiRequest<Wrapped<VehicleTrip>>(
    `${CORE_API_BASE_URL}/trips/${encodeURIComponent(tripId)}`
  )
  return unwrap(response)
}

export async function listMunicipalRoutes(
  municipalityId: string,
  options: { skipAuth?: boolean } = {}
) {
  const response = await apiRequest<Wrapped<MunicipalRoute[]>>(
    `${CORE_API_BASE_URL}/municipal-routes?municipalityId=${encodeURIComponent(
      municipalityId
    )}&allowedUse=SPECIAL_PERMIT&active=true`,
    { skipAuth: options.skipAuth }
  )
  return unwrap(response)
}

export async function createSpecialPermitRouteRequest(
  payload: SpecialPermitRouteRequestPayload
) {
  const response = await apiRequest<Wrapped<SpecialPermitRouteRequest>>(
    `${CORE_API_BASE_URL}/special-permit-route-requests`,
    {
      method: "POST",
      body: { data: payload },
    }
  )
  return unwrap(response)
}

export async function listTripsByVehicle(vehicleId: string) {
  const response = await apiRequest<Wrapped<VehicleTrip[]>>(
    `${CORE_API_BASE_URL}/trips?vehicleId=${encodeURIComponent(vehicleId)}`
  )
  return unwrap(response)
}

export function createLegacyTrip(payload: TripCreatePayload) {
  return apiRequest<VehicleTrip>(`${CORE_API_BASE_URL}/trips`, {
    method: "POST",
    body: { data: payload },
  })
}
