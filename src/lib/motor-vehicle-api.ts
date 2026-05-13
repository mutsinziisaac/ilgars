import { apiRequest, resolveApiBaseUrl } from "@/lib/api"

export type MotorVehicleLogbook = {
  colour: string | null
  currentLogbookCapacity: number | null
  engineCapacityCc: number | null
  engineCylinders: number | null
  engineNumber: string | null
  exemptionStatus: string | null
  fuelType: string | null
  gearboxDescription: string | null
  gearboxType: string | null
  grossWeightFrontKg: number | null
  grossWeightMiddleKg: number | null
  grossWeightRearKg: number | null
  grossWeightTotalKg: number | null
  id: string
  logbookCapacityKg: number | null
  logbookNumber: string | null
  logbookSeries: string | null
  make: string | null
  model: string | null
  operatorName: string | null
  operatorReference: string | null
  ownerId: string | null
  plateNumber: string
  registrationDate: string | null
  registrationDepartment: string | null
  serviceType: string | null
  status: string | null
  tareWeightKg: number | null
  truckNumber: string | null
  tyreMeasurements: string | null
  vinOrChassis: string | null
  weighbridgeExternalRef: string | null
}

type MotorVehicleListResponse =
  | MotorVehicleLogbook[]
  | {
      data?:
        | MotorVehicleLogbook[]
        | {
            content?: MotorVehicleLogbook[]
            items?: MotorVehicleLogbook[]
          }
      content?: MotorVehicleLogbook[]
      items?: MotorVehicleLogbook[]
    }

type MotorVehicleResponse = MotorVehicleLogbook | { data: MotorVehicleLogbook }

const MOTOR_VEHICLE_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_MOTOR_VEHICLE_API_BASE_URL,
  "/motorvehicle/api/v1"
)

export function compactPlateNumber(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

function unwrapVehicle(response: MotorVehicleResponse): MotorVehicleLogbook {
  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    response.data
  ) {
    return response.data
  }
  return response as MotorVehicleLogbook
}

export async function getVehicleByPlate(
  plate: string,
  options: { skipAuth?: boolean } = {}
) {
  const plateNumber = compactPlateNumber(plate)

  const response = await apiRequest<MotorVehicleResponse>(
    `${MOTOR_VEHICLE_BASE_URL}/vehicles/by-plate/${encodeURIComponent(plateNumber)}`,
    { skipAuth: options.skipAuth }
  )
  return unwrapVehicle(response)
}

function unwrapVehicleList(
  response: MotorVehicleListResponse
): MotorVehicleLogbook[] {
  if (Array.isArray(response)) return response
  if (Array.isArray(response.data)) return response.data
  if (Array.isArray(response.data?.content)) return response.data.content
  if (Array.isArray(response.data?.items)) return response.data.items
  if (Array.isArray(response.content)) return response.content
  if (Array.isArray(response.items)) return response.items
  return []
}

export async function listMockVehicles(page = 0, size = 100) {
  const response = await apiRequest<MotorVehicleListResponse>(
    `${MOTOR_VEHICLE_BASE_URL}/vehicles?page=${page}&size=${size}`
  )
  return unwrapVehicleList(response)
}
