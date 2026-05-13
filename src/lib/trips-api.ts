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
  createdBy: string
  reason: string
  expectedDurationDays: number
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

export function getTripsByVehicleId(vehicleId: string) {
  return apiRequest<VehicleTrip[]>(
    `${CORE_API_BASE_URL}/trips?vehicleId=${encodeURIComponent(vehicleId)}`
  )
}

export function createTrip(payload: TripCreatePayload) {
  return apiRequest<VehicleTrip>(`${CORE_API_BASE_URL}/trips`, {
    method: "POST",
    body: payload,
  })
}
