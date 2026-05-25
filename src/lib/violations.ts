import type { TFunction } from "i18next"

import { formatCurrencyMzn } from "@/i18n/format"
import type { MyFleetViolation } from "@/lib/fleet-vehicles-api"

export type ViolationTone = "compliant" | "warning" | "critical"

export function isOpenViolation(violation: MyFleetViolation): boolean {
  const status = (violation.status ?? "").toUpperCase()
  return status !== "RESOLVED" && status !== "RELEASED"
}

export function violationToneForList(openViolations: MyFleetViolation[]): ViolationTone {
  if (openViolations.length === 0) return "compliant"
  const hasAvailable = openViolations.some(
    (v) => (v.status ?? "").toUpperCase() === "AVAILABLE"
  )
  return hasAvailable ? "critical" : "warning"
}

export function violationStatusTone(status: string | null | undefined): ViolationTone {
  const upper = (status ?? "").toUpperCase()
  if (upper === "AVAILABLE") return "critical"
  if (upper === "RESPONDING") return "warning"
  return "compliant"
}

function humanize(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "-"
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function violationStatusLabel(status: string | null | undefined, t: TFunction): string {
  const upper = (status ?? "").toUpperCase()
  switch (upper) {
    case "AVAILABLE":
      return t("fleet.violationStatus.available")
    case "RESPONDING":
      return t("fleet.violationStatus.responding")
    case "RESOLVED":
      return t("fleet.violationStatus.resolved")
    case "RELEASED":
      return t("fleet.violationStatus.released")
    default:
      return humanize(status)
  }
}

export function violationCodeLabel(code: string | null | undefined, t: TFunction): string {
  const upper = (code ?? "").toUpperCase()
  switch (upper) {
    case "OUTSTANDING_PAYMENTS":
      return t("fleet.violationCode.outstandingPayments")
    case "EXPIRED_RUC":
      return t("fleet.violationCode.expiredRuc")
    case "DEVICE_TAMPERED":
      return t("fleet.violationCode.deviceTampered")
    case "SIGNAL_LOST":
      return t("fleet.violationCode.signalLost")
    case "POWER_DISCONNECTED":
      return t("fleet.violationCode.powerDisconnected")
    case "UN_AUTHORIZED_ROUTE":
      return t("fleet.violationCode.unauthorizedRoute")
    case "GEOFENCE_NATIONAL_ROAD":
      return t("fleet.violationCode.geofenceNationalRoad")
    default:
      return humanize(code)
  }
}

export function formatViolationAmount(violation: MyFleetViolation): string | null {
  const amount = Number(violation.amountDue ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const currency = violation.currency ?? "MZN"
  return `${formatCurrencyMzn(amount)} ${currency}`
}

export function sumOpenAmountMzn(openViolations: MyFleetViolation[]): number {
  return openViolations.reduce((acc, v) => {
    const currency = (v.currency ?? "MZN").toUpperCase()
    if (currency !== "MZN") return acc
    const amount = Number(v.amountDue ?? 0)
    return Number.isFinite(amount) ? acc + amount : acc
  }, 0)
}
