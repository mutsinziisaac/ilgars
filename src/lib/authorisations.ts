// Authorisation workflow — §7 of the v4 spec.
// In-memory submission mock for the demo. Real backend would persist these.

import type { Vehicle } from "./fleet"
import type { Route } from "./routes"
import type { LicenceType } from "./v4-rules"

export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "POLICE_ESCORT_ARRANGED"
  | "APPROVED_BY_DIRECTORATE"
  | "SIGNED_BY_PRESIDENT"
  | "ACTIVE"
  | "EXPIRED"
  | "REJECTED"

export type ApplicationHistoryEntry = {
  status: ApplicationStatus
  at: string // ISO
  actor?: string
  note?: string
}

export type LicenceApplication = {
  id: string
  reference: string
  vehicle: Vehicle
  route: Route
  licenceType: LicenceType
  durationDays: number
  feeDueOnActivationMzn: number
  attachments?: {
    livreteFilename?: string
    titleFilename?: string
    justification?: string
    escortRequestRef?: string
  }
  submittedAt: string
  status: ApplicationStatus
  estimatedDecisionWindowLabel: string
  history: ApplicationHistoryEntry[]
}

// §7.1 (NIGHT_RESTRICTED) and §7.2 (EXCEPTIONAL) state-machine ordering.
export function lifecycleFor(licenceType: LicenceType): ApplicationStatus[] {
  if (licenceType === "EXCEPTIONAL") {
    return [
      "SUBMITTED",
      "UNDER_REVIEW",
      "POLICE_ESCORT_ARRANGED",
      "APPROVED_BY_DIRECTORATE",
      "SIGNED_BY_PRESIDENT",
      "ACTIVE",
    ]
  }
  return [
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED_BY_DIRECTORATE",
    "SIGNED_BY_PRESIDENT",
    "ACTIVE",
  ]
}

export function statusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "DRAFT": return "Draft"
    case "SUBMITTED": return "Submitted"
    case "UNDER_REVIEW": return "Under review"
    case "POLICE_ESCORT_ARRANGED": return "Police escort arranged"
    case "APPROVED_BY_DIRECTORATE": return "Approved by directorate"
    case "SIGNED_BY_PRESIDENT": return "Signed by president"
    case "ACTIVE": return "Active"
    case "EXPIRED": return "Expired"
    case "REJECTED": return "Rejected"
  }
}

export function estimatedReviewWindow(licenceType: LicenceType): string {
  switch (licenceType) {
    case "PORT_EXEMPT": return "≈ 1 working day"
    case "NIGHT_RESTRICTED": return "≈ 3 working days"
    case "EXCEPTIONAL": return "5–10 working days"
    case "STANDARD": return "Immediate (pay-now)"
  }
}

let applicationCounter = 7341
function nextReference(licenceType: LicenceType): string {
  applicationCounter += 1
  const prefix =
    licenceType === "EXCEPTIONAL" ? "EXC"
    : licenceType === "PORT_EXEMPT" ? "PRT"
    : licenceType === "NIGHT_RESTRICTED" ? "NGT"
    : "STD"
  return `APP-${prefix}-2026-0${applicationCounter}`
}

export type SubmitApplicationInput = {
  vehicle: Vehicle
  route: Route
  licenceType: LicenceType
  durationDays: number
  feeDueOnActivationMzn: number
  attachments?: LicenceApplication["attachments"]
}

export function submitApplication(input: SubmitApplicationInput): Promise<LicenceApplication> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const submittedAt = new Date().toISOString()
      const reference = nextReference(input.licenceType)
      resolve({
        id: reference,
        reference,
        vehicle: input.vehicle,
        route: input.route,
        licenceType: input.licenceType,
        durationDays: input.durationDays,
        feeDueOnActivationMzn: input.feeDueOnActivationMzn,
        attachments: input.attachments,
        submittedAt,
        status: "SUBMITTED",
        estimatedDecisionWindowLabel: estimatedReviewWindow(input.licenceType),
        history: [
          { status: "DRAFT", at: submittedAt, actor: "operator" },
          { status: "SUBMITTED", at: submittedAt, actor: "operator", note: "Application lodged with Municipal Directorate." },
        ],
      })
    }, 1_200)
  })
}
