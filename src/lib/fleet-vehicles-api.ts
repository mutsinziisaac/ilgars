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

export function createFleetVehicle(payload: FleetVehicleRegistrationPayload) {
  return apiRequest<FleetVehicle>(`${CORE_API_BASE_URL}/fleet-vehicles`, {
    method: "POST",
    body: payload,
  })
}

export function getActiveFleetVehicles() {
  return apiRequest<FleetVehicle[]>(
    `${CORE_API_BASE_URL}/fleet-vehicles?status=ACTIVE`
  )
}
