import { apiRequest, resolveApiBaseUrl } from "@/lib/api"

const CORE_API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  "/core/api/v1"
)

export type DeviceRequestStatus = "PENDING" | "APPROVED" | "REJECTED"

export type DeviceRequestInput = {
  vehicleId: string
  municipalityId: string
  vehiclePlateSnapshot: string
  reason?: string
}

export type DeviceRequest = {
  id: string
  vehicleId: string
  status: DeviceRequestStatus
  deviceId?: string | null
  decisionNotes?: string | null
  createdAt?: string | null
  decidedAt?: string | null
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

export async function createDeviceRequest(input: DeviceRequestInput) {
  const response = await apiRequest<Wrapped<DeviceRequest>>(
    `${CORE_API_BASE_URL}/device-requests`,
    {
      method: "POST",
      body: { data: input },
    }
  )
  return unwrap(response)
}

export async function getVehicleDeviceRequests(vehicleId: string) {
  const response = await apiRequest<Wrapped<DeviceRequest[]>>(
    `${CORE_API_BASE_URL}/device-requests?vehicleId=${encodeURIComponent(
      vehicleId
    )}`
  )
  return unwrap(response)
}
