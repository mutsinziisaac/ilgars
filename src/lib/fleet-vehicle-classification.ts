import type { FleetVehicle } from "@/lib/fleet-vehicles-api"

const HEAVY_VEHICLE_TONNES_THRESHOLD = 8

export type CapacityVehicleClass = "MEDIUM_VEHICLE" | "HEAVY_VEHICLE"

export function capacityTonnes(vehicle: FleetVehicle): number {
  const value = Number(vehicle.capacitySnapshot)
  if (!Number.isFinite(value)) return 0
  return vehicle.capacityUnit === "KG" ? value / 1000 : value
}

export function classifyFleetVehicleCapacity(
  vehicle: FleetVehicle
): CapacityVehicleClass {
  return capacityTonnes(vehicle) > HEAVY_VEHICLE_TONNES_THRESHOLD
    ? "HEAVY_VEHICLE"
    : "MEDIUM_VEHICLE"
}

export function capacityClassLabel(vehicle: FleetVehicle): string {
  return classifyFleetVehicleCapacity(vehicle) === "HEAVY_VEHICLE"
    ? "Heavy vehicle"
    : "Medium vehicle"
}
