import type { FleetVehicle } from "@/lib/fleet-vehicles-api"

const DEFAULT_HEAVY_VEHICLE_TONNES_THRESHOLD = 20

export type CapacityVehicleClass = "MEDIUM_VEHICLE" | "HEAVY_VEHICLE"

let policyThresholdTonnes: number | null = null

export function setHeavyVehicleThresholdFromPolicy(
  threshold: number,
  unit: string
) {
  if (!Number.isFinite(threshold) || threshold <= 0) return
  policyThresholdTonnes = unit === "KG" ? threshold / 1000 : threshold
}

export function heavyVehicleThresholdTonnes(): number {
  if (policyThresholdTonnes !== null) return policyThresholdTonnes
  const value = Number(import.meta.env.VITE_THRESHOLD)
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_HEAVY_VEHICLE_TONNES_THRESHOLD
}

export function heavyVehicleThresholdKg(): number {
  return heavyVehicleThresholdTonnes() * 1000
}

export function isHeavyVehicleCapacityTonnes(value: number): boolean {
  return Number.isFinite(value) && value > heavyVehicleThresholdTonnes()
}

export function isHeavyVehicleWeightKg(value: number): boolean {
  return Number.isFinite(value) && value > heavyVehicleThresholdKg()
}

export function capacityTonnes(vehicle: FleetVehicle): number {
  const value = Number(vehicle.capacitySnapshot)
  if (!Number.isFinite(value)) return 0
  return vehicle.capacityUnit === "KG" ? value / 1000 : value
}

export function classifyFleetVehicleCapacity(
  vehicle: FleetVehicle
): CapacityVehicleClass {
  return isHeavyVehicleCapacityTonnes(capacityTonnes(vehicle))
    ? "HEAVY_VEHICLE"
    : "MEDIUM_VEHICLE"
}

export function capacityClassLabel(vehicle: FleetVehicle): string {
  return classifyFleetVehicleCapacity(vehicle) === "HEAVY_VEHICLE"
    ? "Heavy vehicle"
    : "Medium vehicle"
}
