import { apiRequest, resolveApiBaseUrl } from "@/lib/api"
import {
  compactPlateNumber,
  type MotorVehicleLogbook,
} from "@/lib/motor-vehicle-api"

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

export type TripListItem = VehicleTrip & {
  createdAt?: string
  enteredAt?: string
  vehicle?: {
    vehicleId?: string
    plateNumber?: string | null
    truckNumber?: string | null
    ownerName?: string | null
    operatorName?: string | null
    capacity?: number | null
    capacityUnit?: string | null
    registryStatus?: string | null
    [key: string]: unknown
  }
  route?: {
    routeId?: string | null
    id?: string | null
    code?: string | null
    name?: string | null
    selectionStatus?: string | null
    [key: string]: unknown
  }
  payment?: {
    paymentMode?: string
    totalFeeAmount?: number
    paidFeeAmount?: number
    outstandingFeeAmount?: number
    feeCount?: number
    prn?: string | null
    invoiceId?: string | null
    latestFeeStatus?: string | null
    fees?: Array<{
      amount?: number
      createdAt?: string
      coverageStart?: string
      coverageEnd?: string
      durationDays?: number
      exactMinutes?: number
      [key: string]: unknown
    }>
    [key: string]: unknown
  }
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
  code?: string
  routeName?: string
  name?: string
  routeCode?: string
  roadType?: string
  distanceKm?: number
  allowedUse?: string
  allowedUses?: string[]
  active?: boolean
  geoJson?: string
  [key: string]: unknown
}

export type RoadClosurePurpose =
  | "CONSTRUCTION"
  | "FILMING"
  | "SPORTING_EVENT"
  | "PARADE"
  | "PRIVATE_EVENT"
  | "PROTOCOL"
  | "OTHER"

export type RoadClosurePermitCreatePayload = {
  municipalityId: string
  routeId: string
  purpose: RoadClosurePurpose
  requestedStartAt: string
  requestedEndAt: string
  conditions?: string
}

export type RoadClosurePermitInvoice = {
  id?: string
  prn?: string
  amount?: number
  totalAmount?: number
  currency?: string
  status?: string
  distanceKm?: number
  durationHours?: number
  ratePerKmHour?: number
  [key: string]: unknown
}

export type RoadClosurePermit = {
  id: string
  status: string
  municipalityId?: string
  applicantName?: string
  applicantPhone?: string
  purpose?: RoadClosurePurpose | string
  requestedStartAt?: string
  requestedEndAt?: string
  conditions?: string | null
  route?: Partial<MunicipalRoute> & {
    distanceKm?: number
  }
  invoice?: RoadClosurePermitInvoice | null
  licence?: {
    licenceType?: string
    licenceNumber?: string
    qrPayload?: unknown
    [key: string]: unknown
  } | null
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

type PublicPrepaidTripVehicleResponse =
  | MotorVehicleLogbook
  | {
      vehicle?: PublicPrepaidTripVehicleResponse
      logbook?: PublicPrepaidTripVehicleResponse
      motorVehicle?: PublicPrepaidTripVehicleResponse
      id?: string | null
      vehicleId?: string | null
      plate?: string | null
      plateNumber?: string | null
      plateNumberSnapshot?: string | null
      numberPlate?: string | null
      truckNumber?: string | null
      truckNumberSnapshot?: string | null
      capacity?: number | null
      capacitySnapshot?: number | null
      capacityUnit?: string | null
      operatorName?: string | null
      operatorNameSnapshot?: string | null
      ownerName?: string | null
      ownerNameSnapshot?: string | null
      [key: string]: unknown
    }

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

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value
  }
  return null
}

function normalizePublicPrepaidTripVehicle(
  response: PublicPrepaidTripVehicleResponse
): MotorVehicleLogbook {
  const container = response as Record<string, unknown>
  const vehicle =
    container.vehicle ?? container.logbook ?? container.motorVehicle ?? response
  const source = vehicle as Record<string, unknown>

  const plateNumber = firstString(
    source.plateNumber,
    source.plateNumberSnapshot,
    source.plate,
    source.numberPlate
  )
  const id = firstString(source.id, source.vehicleId)

  return {
    ...(source as Partial<MotorVehicleLogbook>),
    id: id ?? "",
    plateNumber: plateNumber ?? "",
    truckNumber:
      firstString(source.truckNumber, source.truckNumberSnapshot) ?? null,
    operatorName:
      firstString(source.operatorName, source.operatorNameSnapshot) ?? null,
    ownerId: firstString(
      source.ownerId,
      source.ownerName,
      source.ownerNameSnapshot
    ),
    grossWeightTotalKg: firstNumber(
      source.grossWeightTotalKg,
      source.logbookCapacityKg,
      source.currentLogbookCapacity,
      source.capacity,
      source.capacitySnapshot
    ),
  } as MotorVehicleLogbook
}

export async function getTripsByVehicleId(vehicleId: string) {
  const response = await apiRequest<Wrapped<VehicleTrip[]>>(
    `${CORE_API_BASE_URL}/trips?vehicleId=${encodeURIComponent(vehicleId)}`
  )
  return unwrap(response)
}

export async function listTrips() {
  const response = await apiRequest<Wrapped<TripListItem[]>>(
    `${CORE_API_BASE_URL}/trips`
  )
  return unwrap(response)
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

export async function getPublicPrepaidTripVehicleByPlate(plate: string) {
  const plateNumber = compactPlateNumber(plate)
  const response = await apiRequest<Wrapped<PublicPrepaidTripVehicleResponse>>(
    `${CORE_API_BASE_URL}/public/prepaid-trips/vehicles/by-plate/${encodeURIComponent(
      plateNumber
    )}`,
    { skipAuth: true }
  )
  return normalizePublicPrepaidTripVehicle(unwrap(response))
}

export async function getTripDetail(tripId: string) {
  const response = await apiRequest<Wrapped<VehicleTrip>>(
    `${CORE_API_BASE_URL}/trips/${encodeURIComponent(tripId)}`
  )
  return unwrap(response)
}

export async function listMunicipalRoutes(
  municipalityId: string,
  options: {
    allowedUse?: "SPECIAL_PERMIT" | "ROAD_CLOSURE"
    skipAuth?: boolean
  } = {}
) {
  const allowedUse = options.allowedUse ?? "SPECIAL_PERMIT"
  const response = await apiRequest<Wrapped<MunicipalRoute[]>>(
    `${CORE_API_BASE_URL}/municipal-routes?municipalityId=${encodeURIComponent(
      municipalityId
    )}&allowedUse=${encodeURIComponent(allowedUse)}&active=true`,
    { skipAuth: options.skipAuth }
  )
  return unwrap(response)
}

export async function listRoadClosureRoutes(municipalityId: string) {
  return listMunicipalRoutes(municipalityId, { allowedUse: "ROAD_CLOSURE" })
}

export async function getMunicipalRoute(routeId: string) {
  const response = await apiRequest<Wrapped<MunicipalRoute>>(
    `${CORE_API_BASE_URL}/municipal-routes/${encodeURIComponent(routeId)}`
  )
  return unwrap(response)
}

export async function listRoadClosurePermits(
  municipalityId: string,
  status = "PENDING_ADMIN_APPROVAL"
) {
  const response = await apiRequest<Wrapped<RoadClosurePermit[]>>(
    `${CORE_API_BASE_URL}/road-closure-permits?municipalityId=${encodeURIComponent(
      municipalityId
    )}&status=${encodeURIComponent(status)}`
  )
  return unwrap(response)
}

export async function createRoadClosurePermit(
  payload: RoadClosurePermitCreatePayload
) {
  const response = await apiRequest<Wrapped<RoadClosurePermit>>(
    `${CORE_API_BASE_URL}/road-closure-permits`,
    {
      method: "POST",
      body: { data: payload },
    }
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
