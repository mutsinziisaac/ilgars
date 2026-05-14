import { apiRequest, resolveApiBaseUrl } from "@/lib/api"

const CORE_API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  "/core/api/v1"
)

export type FleetVehicleRegistrationPayload = {
  vehicleId: string
  plateNumber: string
  truckNumber: string
  ownerName: string
  operatorName: string
  capacitySnapshot: number
  capacityUnit: "TONNES"
  registryStatus: string
  exemptionStatus: string
  compliantForRating: boolean
  source: "OWNER_SELECTED"
}

export type FleetVehicle = {
  addedAt: string
  addedBySubject: string
  capacitySnapshot: number
  capacityUnit: string
  compliantForRating: boolean
  exemptionStatus: string
  fleetId: string
  id: string
  operatorNameSnapshot: string
  ownerNameSnapshot: string
  plateNumberSnapshot: string
  registryStatus: string
  source: string
  status: string
  truckNumberSnapshot: string
  updatedAt: string
  vehicleId: string
  vehicleSnapshotAt: string
}

export type MyFleetVehicleSnapshot = {
  vehicleId: string
  plateNumber: string
  truckNumber: string | null
  ownerName: string | null
  operatorName: string | null
  capacity: number | null
  capacityUnit: string | null
  registryStatus: string | null
  [key: string]: unknown
}

export type MyFleetTripContext = {
  onTrip?: boolean
  tripStatus?: string | null
  tripId?: string | null
  municipalityId?: string | null
  paymentMode?: string | null
  billingStatus?: string | null
  outstandingFeeAmount?: number | null
  totalFeeAmount?: number | null
  paidFeeAmount?: number | null
  expectedDurationDays?: number | null
  [key: string]: unknown
}

export type MyFleetLocationContext = {
  hasLocation?: boolean
  source?: string | null
  latitude?: number | null
  longitude?: number | null
  observedAt?: string | null
  [key: string]: unknown
}

export type MyFleetDeviceContext = {
  trackerAssigned?: boolean
  assignmentId?: string | null
  deviceId?: string | null
  deviceUid?: string | null
  serialNumber?: string | null
  imei?: string | null
  health?: {
    status?: string | null
    reason?: string | null
    lastSeenAt?: string | null
    lastLocationAt?: string | null
    stale?: boolean
    [key: string]: unknown
  } | null
  latestLocation?: MyFleetLocationContext | null
  locations?: unknown[]
  [key: string]: unknown
}

export type MyFleetItem = {
  id: string
  vehicleId: string
  status: string
  vehicle: MyFleetVehicleSnapshot
  trip?: MyFleetTripContext | null
  location?: MyFleetLocationContext | null
  device?: MyFleetDeviceContext | null
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

export async function createFleetVehicle(payload: FleetVehicleRegistrationPayload) {
  const response = await apiRequest<Wrapped<MyFleetItem>>(`${CORE_API_BASE_URL}/myfleet`, {
    method: "POST",
    body: { data: { vehicleId: payload.vehicleId } },
  })
  return unwrap(response)
}

export function getActiveFleetVehicles() {
  return apiRequest<FleetVehicle[]>(
    `${CORE_API_BASE_URL}/fleet-vehicles?status=ACTIVE`
  )
}

export async function getMyFleetVehicles(status = "ACTIVE") {
  const response = await apiRequest<Wrapped<MyFleetItem[]>>(
    `${CORE_API_BASE_URL}/myfleet?status=${encodeURIComponent(status)}`
  )
  return unwrap(response)
}
