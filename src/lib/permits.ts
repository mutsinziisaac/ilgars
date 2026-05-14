export type PermitStatus =
  | "active"
  | "pending-review"
  | "awaiting-payment"
  | "rejected"
  | "completed"

export type PermitCategory =
  | "filming"
  | "construction"
  | "sporting-event"
  | "protocol"
  | "parade"
  | "private-event"

export type RoadClass = "primary" | "secondary" | "protocol" | "tertiary"

export type Permit = {
  id: string
  category: PermitCategory
  road: string
  status: PermitStatus
  startsAt: string
  endsAt: string
  roadClass: RoadClass
  hourlyRateMzn: number
  totalMzn: number
  segment: [number, number][]
  rejectedReason?: string
}

export const PERMIT_STATUS_LABELS: Record<PermitStatus, string> = {
  active: "Active",
  "pending-review": "Pending review",
  "awaiting-payment": "Awaiting payment",
  rejected: "Rejected",
  completed: "Completed",
}

export const PERMIT_CATEGORY_LABELS: Record<PermitCategory, string> = {
  filming: "Filming",
  construction: "Construction",
  "sporting-event": "Sporting event",
  protocol: "Protocol",
  parade: "Parade",
  "private-event": "Private event",
}

export const ROAD_CLASS_LABELS: Record<RoadClass, string> = {
  primary: "Primary",
  secondary: "Secondary",
  protocol: "Protocol",
  tertiary: "Tertiary",
}

const ACTIVE_START = new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString()
const ACTIVE_END = new Date(Date.now() + 1000 * 60 * 60 * 3 + 1000 * 60 * 12).toISOString()

export const PERMITS: Permit[] = [
  {
    id: "PRM-26-0823",
    category: "filming",
    road: "Av. Julius Nyerere",
    status: "awaiting-payment",
    startsAt: "2026-05-16T06:00:00",
    endsAt: "2026-05-16T11:00:00",
    roadClass: "secondary",
    hourlyRateMzn: 30_000,
    totalMzn: 150_000,
    segment: [
      [-25.9588, 32.6042],
      [-25.9568, 32.6044],
      [-25.9548, 32.6047],
      [-25.9528, 32.6049],
      [-25.9508, 32.6051],
    ],
  },
  {
    id: "PRM-26-0815",
    category: "construction",
    road: "Av. Marginal",
    status: "active",
    startsAt: ACTIVE_START,
    endsAt: ACTIVE_END,
    roadClass: "secondary",
    hourlyRateMzn: 5_000,
    totalMzn: 80_000,
    segment: [
      [-25.9618, 32.6118],
      [-25.9598, 32.6132],
      [-25.9578, 32.6146],
      [-25.9558, 32.6158],
      [-25.9538, 32.6170],
      [-25.9518, 32.6180],
    ],
  },
  {
    id: "PRM-26-0809",
    category: "sporting-event",
    road: "Av. da União Africana",
    status: "pending-review",
    startsAt: "2026-05-17T06:00:00",
    endsAt: "2026-05-17T10:00:00",
    roadClass: "protocol",
    hourlyRateMzn: 5_000,
    totalMzn: 20_000,
    segment: [
      [-25.9582, 32.5946],
      [-25.9582, 32.5972],
      [-25.9580, 32.5998],
      [-25.9580, 32.6024],
      [-25.9580, 32.6048],
    ],
  },
  {
    id: "PRM-26-0808",
    category: "parade",
    road: "Av. 24 de Julho",
    status: "pending-review",
    startsAt: "2026-05-23T09:00:00",
    endsAt: "2026-05-23T13:00:00",
    roadClass: "primary",
    hourlyRateMzn: 12_500,
    totalMzn: 50_000,
    segment: [
      [-25.9692, 32.5784],
      [-25.9692, 32.5814],
      [-25.9694, 32.5844],
      [-25.9694, 32.5874],
      [-25.9696, 32.5904],
      [-25.9696, 32.5934],
    ],
  },
  {
    id: "PRM-26-0795",
    category: "filming",
    road: "Av. Marginal",
    status: "rejected",
    startsAt: "2026-05-10T05:00:00",
    endsAt: "2026-05-10T12:00:00",
    roadClass: "secondary",
    hourlyRateMzn: 30_000,
    totalMzn: 210_000,
    rejectedReason: "Conflicts with concurrent construction permit",
    segment: [
      [-25.9510, 32.6182],
      [-25.9490, 32.6190],
      [-25.9470, 32.6196],
      [-25.9450, 32.6202],
      [-25.9430, 32.6206],
    ],
  },
  {
    id: "PRM-26-0782",
    category: "construction",
    road: "Av. Vladimir Lenine",
    status: "completed",
    startsAt: "2026-04-28T07:00:00",
    endsAt: "2026-04-28T17:00:00",
    roadClass: "primary",
    hourlyRateMzn: 8_000,
    totalMzn: 80_000,
    segment: [
      [-25.9678, 32.5798],
      [-25.9650, 32.5800],
      [-25.9620, 32.5802],
      [-25.9590, 32.5804],
      [-25.9560, 32.5806],
    ],
  },
  {
    id: "PRM-26-0771",
    category: "sporting-event",
    road: "Av. Eduardo Mondlane",
    status: "completed",
    startsAt: "2026-04-25T06:00:00",
    endsAt: "2026-04-25T11:00:00",
    roadClass: "primary",
    hourlyRateMzn: 12_500,
    totalMzn: 62_500,
    segment: [
      [-25.9682, 32.5760],
      [-25.9684, 32.5790],
      [-25.9686, 32.5820],
      [-25.9688, 32.5850],
      [-25.9690, 32.5880],
      [-25.9692, 32.5910],
    ],
  },
  {
    id: "PRM-26-0763",
    category: "protocol",
    road: "Av. Friedrich Engels",
    status: "completed",
    startsAt: "2026-04-22T08:00:00",
    endsAt: "2026-04-22T11:00:00",
    roadClass: "protocol",
    hourlyRateMzn: 5_000,
    totalMzn: 15_000,
    segment: [
      [-25.9622, 32.6062],
      [-25.9606, 32.6072],
      [-25.9590, 32.6080],
      [-25.9572, 32.6088],
      [-25.9554, 32.6094],
    ],
  },
  {
    id: "PRM-26-0758",
    category: "private-event",
    road: "Av. Mao Tse Tung",
    status: "completed",
    startsAt: "2026-04-19T18:00:00",
    endsAt: "2026-04-19T23:00:00",
    roadClass: "tertiary",
    hourlyRateMzn: 2_500,
    totalMzn: 12_500,
    segment: [
      [-25.9576, 32.5948],
      [-25.9568, 32.5970],
      [-25.9560, 32.5992],
      [-25.9552, 32.6014],
      [-25.9544, 32.6036],
    ],
  },
  {
    id: "PRM-26-0744",
    category: "filming",
    road: "Av. Karl Marx",
    status: "completed",
    startsAt: "2026-04-12T05:00:00",
    endsAt: "2026-04-12T09:00:00",
    roadClass: "secondary",
    hourlyRateMzn: 30_000,
    totalMzn: 120_000,
    segment: [
      [-25.9740, 32.5752],
      [-25.9722, 32.5760],
      [-25.9704, 32.5768],
      [-25.9686, 32.5774],
      [-25.9668, 32.5780],
    ],
  },
  {
    id: "PRM-26-0731",
    category: "parade",
    road: "Av. Acordos de Lusaka",
    status: "completed",
    startsAt: "2026-04-05T08:00:00",
    endsAt: "2026-04-05T12:00:00",
    roadClass: "primary",
    hourlyRateMzn: 12_500,
    totalMzn: 50_000,
    segment: [
      [-25.9460, 32.5810],
      [-25.9450, 32.5836],
      [-25.9442, 32.5862],
      [-25.9434, 32.5888],
      [-25.9428, 32.5914],
    ],
  },
  {
    id: "PRM-26-0719",
    category: "construction",
    road: "Av. Kim Il Sung",
    status: "completed",
    startsAt: "2026-03-29T06:00:00",
    endsAt: "2026-03-29T18:00:00",
    roadClass: "tertiary",
    hourlyRateMzn: 2_500,
    totalMzn: 30_000,
    segment: [
      [-25.9648, 32.5852],
      [-25.9628, 32.5856],
      [-25.9608, 32.5860],
      [-25.9588, 32.5864],
      [-25.9568, 32.5868],
    ],
  },
]

export function permitsByStatus(status: PermitStatus | "all"): Permit[] {
  if (status === "all") return PERMITS
  return PERMITS.filter((p) => p.status === status)
}

export function permitStatusCounts(): Record<PermitStatus | "all", number> {
  const counts: Record<PermitStatus | "all", number> = {
    all: PERMITS.length,
    active: 0,
    "pending-review": 0,
    "awaiting-payment": 0,
    rejected: 0,
    completed: 0,
  }
  for (const p of PERMITS) counts[p.status] += 1
  return counts
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function formatPermitSchedule(p: Permit, now: Date = new Date()): string {
  const start = new Date(p.startsAt)
  const end = new Date(p.endsAt)
  const durationMs = end.getTime() - start.getTime()
  const durationHours = Math.round(durationMs / (1000 * 60 * 60))

  if (p.status === "active") {
    const remainingMs = end.getTime() - now.getTime()
    if (remainingMs <= 0) return i18n.t("permits.endedJustNow")
    const totalMinutes = Math.floor(remainingMs / (1000 * 60))
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    if (h === 0) return i18n.t("permits.nowEndsMinutes", { minutes: m })
    return i18n.t("permits.nowEndsHours", { hours: h, minutes: pad2(m) })
  }

  const dow = formatDateValue(start, { weekday: "short" })
  const day = start.getDate()
  const month = formatDateValue(start, { month: "short" })
  return i18n.t("permits.schedule", {
    weekday: dow,
    day,
    month,
    start: formatTime(start),
    end: formatTime(end),
    hours: durationHours,
  })
}
import { i18n } from "@/i18n"
import { formatDateValue } from "@/i18n/format"
