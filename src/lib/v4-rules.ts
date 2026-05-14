// Maputo Heavy Vehicle Circulation Licence — v4 business rules
// Pure functions: VC-01 classification, AC-01 access matrix, TW-01..04 time windows,
// FE-01..06 fee resolution, VL-01..11 application validation.

import { WEIGHT_TIERS, weightTierForKg, type Vehicle } from "./fleet"
import {
  heavyVehicleThresholdKg,
  isHeavyVehicleWeightKg,
} from "./fleet-vehicle-classification"
import type { Route, RouteCategory } from "./routes"

export type VehicleClass = "RIGID" | "ARTICULATED"

export type WeightCategory = "OUT_OF_SCOPE" | "MEDIUM_HEAVY" | "RESTRICTED_HEAVY"

export type LicenceType = "STANDARD" | "NIGHT_RESTRICTED" | "PORT_EXEMPT" | "EXCEPTIONAL"

// ── VC-01 ──────────────────────────────────────────────────────────────────
export function vehicleClassFromConfiguration(configuration: string): VehicleClass {
  return /articulated/i.test(configuration) ? "ARTICULATED" : "RIGID"
}

export function thresholdFor(_vehicleClass: VehicleClass, _axles: number): number {
  return heavyVehicleThresholdKg()
}

export function classifyVehicle(input: {
  gvwKg: number
  vehicleClass: VehicleClass
  axles: number
}): WeightCategory {
  if (!Number.isFinite(input.gvwKg) || input.gvwKg <= 8_000) return "OUT_OF_SCOPE"
  return isHeavyVehicleWeightKg(input.gvwKg)
    ? "RESTRICTED_HEAVY"
    : "MEDIUM_HEAVY"
}

export function classifyFleetVehicle(v: Vehicle): WeightCategory {
  return classifyVehicle({
    gvwKg: v.weightKg,
    vehicleClass: vehicleClassFromConfiguration(v.configuration),
    axles: v.axles,
  })
}

// ── TW-01..04 ──────────────────────────────────────────────────────────────
// Night window is [20:00, 06:00) — crosses midnight.
export const NIGHT_WINDOW_LABEL = "20:00–06:00"
export const NIGHT_WINDOW = { fromHour: 20, toHour: 6 } as const

export function isNightWindow(date: Date): boolean {
  const h = date.getHours()
  return h >= NIGHT_WINDOW.fromHour || h < NIGHT_WINDOW.toHour
}

// ── AC-01 ──────────────────────────────────────────────────────────────────
export type AccessDecision = {
  path: "pay-now" | "submit-application" | "blocked"
  licenceType: LicenceType
  requiresEscort: boolean
  lockedTimeWindow?: { label: string }
  feeExempt: boolean
  decisionLine: string
  rationale: string
}

export function evaluateAccess(input: {
  weightCategory: WeightCategory
  routeCategory?: RouteCategory
}): AccessDecision {
  const { weightCategory, routeCategory } = input

  if (weightCategory === "OUT_OF_SCOPE") {
    return {
      path: "blocked",
      licenceType: "STANDARD",
      requiresEscort: false,
      feeExempt: true,
      decisionLine: "Out of scope (≤ 8,000 kg)",
      rationale: "Vehicle GVW is below the RUC minimum; no circulation licence required.",
    }
  }

  if (weightCategory === "MEDIUM_HEAVY") {
    return {
      path: "pay-now",
      licenceType: "STANDARD",
      requiresEscort: false,
      feeExempt: false,
      decisionLine: "MEDIUM_HEAVY · pay-now",
      rationale: "AC-01 row 3: medium-heavy vehicles may enter under postpaid accrual at any time.",
    }
  }

  // RESTRICTED_HEAVY paths — licence type is dictated by the chosen route category.
  if (routeCategory === "PORT_CORRIDOR") {
    return {
      path: "submit-application",
      licenceType: "PORT_EXEMPT",
      requiresEscort: false,
      feeExempt: true,
      decisionLine: "RESTRICTED_HEAVY · port corridor · fee-exempt",
      rationale: "AC-01 row 7 + RT-02: port-bound traffic on the corridor is fee-exempt; audit-only transaction.",
    }
  }

  if (routeCategory === "DESIGNATED") {
    return {
      path: "submit-application",
      licenceType: "NIGHT_RESTRICTED",
      requiresEscort: false,
      lockedTimeWindow: { label: NIGHT_WINDOW_LABEL },
      feeExempt: false,
      decisionLine: `RESTRICTED_HEAVY · designated · night ${NIGHT_WINDOW_LABEL}`,
      rationale: "AC-01 rows 4–6 + TW-02: designated heavy routes are open to restricted vehicles only at night.",
    }
  }

  if (routeCategory === "OTHER") {
    return {
      path: "submit-application",
      licenceType: "EXCEPTIONAL",
      requiresEscort: true,
      feeExempt: false,
      decisionLine: "RESTRICTED_HEAVY · off-list · escorted",
      rationale: "AC-01 row 8 + AU-01: off-list routes require an exceptional authorisation with police escort and dual sign-off.",
    }
  }

  // RESTRICTED_HEAVY but no route picked yet — initial state.
  return {
    path: "submit-application",
    licenceType: "NIGHT_RESTRICTED",
    requiresEscort: false,
    feeExempt: false,
    decisionLine: "RESTRICTED_HEAVY · select a route to determine licence type",
    rationale: "Vehicle is restricted-heavy. Pick a route to see whether it falls under designated, port corridor, or exceptional.",
  }
}

// ── FE-01..06 — fee resolution ─────────────────────────────────────────────
export function resolveFee(input: {
  vehicle: Vehicle
  licenceType: LicenceType
  durationDays: number
}): { dailyMzn: number; totalMzn: number; tierLabel: string } {
  const tier = weightTierForKg(input.vehicle.weightKg) ?? WEIGHT_TIERS[0]

  if (input.licenceType === "PORT_EXEMPT") {
    return { dailyMzn: 0, totalMzn: 0, tierLabel: tier.label }
  }

  // FE-04 base daily tariff from Annex I (weight-band table).
  let dailyMzn = tier.mznPerDay
  // Restricted-night and exceptional carry an uplift over the standard daily rate.
  if (input.licenceType === "NIGHT_RESTRICTED") dailyMzn = Math.round(dailyMzn * 1.25)
  if (input.licenceType === "EXCEPTIONAL") dailyMzn = Math.round(dailyMzn * 1.5)

  const days = Math.max(1, input.durationDays)
  return {
    dailyMzn,
    totalMzn: dailyMzn * days,
    tierLabel: tier.label,
  }
}

// ── VL-01..11 ──────────────────────────────────────────────────────────────
export type ValidationError = {
  code:
    | "VL-01" | "VL-02" | "VL-03" | "VL-04" | "VL-06" | "VL-09" | "VL-11"
  field?: "route" | "window" | "attachments" | "device" | "balance"
  message: string
}

export type ApplicationDraft = {
  vehicle: Vehicle
  route: Route | null
  licenceType: LicenceType
  durationDays: number
  attachments?: {
    livreteFilename?: string
    titleFilename?: string
    justification?: string
    escortRequestRef?: string
  }
  deviceActive?: boolean
  hasOpenPostpaidBalance?: boolean
}

export function validateApplication(draft: ApplicationDraft): ValidationError[] {
  const errors: ValidationError[] = []
  const weightCategory = classifyFleetVehicle(draft.vehicle)

  // VL-01 — restricted licence requires the GVW threshold to be met.
  if (
    (draft.licenceType === "NIGHT_RESTRICTED" || draft.licenceType === "EXCEPTIONAL") &&
    weightCategory !== "RESTRICTED_HEAVY"
  ) {
    errors.push({
      code: "VL-01",
      message: `Vehicle GVW is below the configured ${heavyVehicleThresholdKg().toLocaleString()} kg threshold for restricted-night or exceptional licences.`,
    })
  }

  // VL-02 — route whitelist match (except EXCEPTIONAL).
  if (draft.licenceType === "NIGHT_RESTRICTED" && draft.route?.routeCategory !== "DESIGNATED") {
    errors.push({
      code: "VL-02",
      field: "route",
      message: "Night-restricted licences apply only to designated heavy routes.",
    })
  }
  if (draft.licenceType === "PORT_EXEMPT" && draft.route?.routeCategory !== "PORT_CORRIDOR") {
    errors.push({
      code: "VL-02",
      field: "route",
      message: "Port-exempt licences apply only to the port corridor.",
    })
  }

  // VL-03 — exceptional applications need all four attachments.
  if (draft.licenceType === "EXCEPTIONAL") {
    const a = draft.attachments ?? {}
    if (!a.livreteFilename) {
      errors.push({ code: "VL-03", field: "attachments", message: "Livrete (vehicle registration) is required." })
    }
    if (!a.titleFilename) {
      errors.push({ code: "VL-03", field: "attachments", message: "Title of ownership is required." })
    }
    if (!a.justification || a.justification.trim().length < 20) {
      errors.push({ code: "VL-03", field: "attachments", message: "Justification document must cite extreme necessity (min. 20 chars)." })
    }
    if (!a.escortRequestRef) {
      errors.push({ code: "VL-03", field: "attachments", message: "Police escort request reference is required." })
    }
  }

  // VL-04 — night-restricted operating window must sit in [20:00, 06:00).
  // Enforced by the UI (locked picker), so no runtime check needed here.

  // VL-06 — restricted/exceptional licence requires an active GPS device.
  if (
    (draft.licenceType === "NIGHT_RESTRICTED" || draft.licenceType === "EXCEPTIONAL") &&
    draft.deviceActive === false
  ) {
    errors.push({
      code: "VL-06",
      field: "device",
      message: "Vehicle has no active GPS device installation. Install and activate a certified device first.",
    })
  }

  // VL-11 — open postpaid balance must be settled before raising a new licence.
  if (draft.hasOpenPostpaidBalance) {
    errors.push({
      code: "VL-11",
      field: "balance",
      message: "Settle the open postpaid balance before raising a new licence (VL-11).",
    })
  }

  return errors
}

// Convenience: derive the open-postpaid-balance signal from existing compliance state.
export function hasOpenPostpaidBalance(v: Vehicle): boolean {
  return v.compliance.kind === "overdue" && v.compliance.daysOverdue > 0
}
