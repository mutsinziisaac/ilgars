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

const MOTOR_VEHICLE_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_MOTOR_VEHICLE_API_BASE_URL,
  "/motorvehicle/api/v1"
)

export function compactPlateNumber(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function getVehicleByPlate(plate: string) {
  const plateNumber = compactPlateNumber(plate)

  return apiRequest<MotorVehicleLogbook>(
    `${MOTOR_VEHICLE_BASE_URL}/vehicles/by-plate/${encodeURIComponent(plateNumber)}`
  )
}
