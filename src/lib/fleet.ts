export type Status = "active" | "idle" | "maintenance" | "out-of-service"

export type Compliance =
  | { kind: "compliant"; expDate: string }
  | { kind: "renewal-soon"; daysLeft: number; expDate: string }
  | { kind: "overdue"; daysOverdue: number; expDate: string; penaltyDailyMzn: number }
  | { kind: "expired"; expDate: string }
  | { kind: "disputed"; expDate: string; ref: string }

export type DriverTone = "green" | "cream" | "blue"

export type Driver = {
  name: string
  initials: string
  tone: DriverTone
  role?: string
  badge?: "Driving" | "Idle"
} | null

export type ActiveTrip = {
  id: string
  dayCurrent: number
  dayTotal: number
  startsAt: string
  endsAt: string
  licenceLabel: string
} | null

export type RecentTrip = {
  id: string
  start: string
  end: string
  durationDays: number
  driver: string
  charge: number
  status: "active" | "closed" | "disputed"
}

export type DocumentRow = {
  key: "logbook" | "circulation" | "insurance" | "photos"
  title: string
  subtitle: string
  state: "ok" | "warning" | "critical"
}

export type ComplianceCellState = "paid" | "idle" | "alert"

export type TrackingDeviceStatus =
  | "ACTIVE"
  | "OFFLINE"
  | "TAMPERED"
  | "REQUIRES_INSPECTION"
  | "DECOMMISSIONED"

export type TrackingDeviceProtocol = "TCP" | "MQTT" | "HTTP"

export type TrackingDevice = {
  deviceId: string
  imei: string
  model: string
  firmwareVersion: string
  protocol: TrackingDeviceProtocol
  status: TrackingDeviceStatus
  /** ISO timestamp of the most recent ping. */
  lastSeenAt: string
  sealNumber: string
  /** ISO timestamp of installation. */
  installedAt: string
  installedBy: string
  simIccid: string
  apn: string
}

export const WALLET_BALANCE_MZN = 4_250

export const MONTHLY_CAP_MZN = 20_000

export type PaymentChannel = "mobile" | "bank" | "card" | "wallet"

export type Vehicle = {
  plate: string
  ref: string
  model: string
  year: number
  axles: number
  configuration: string
  weightKg: number
  color: string
  rucClass: string
  chassisVin: string
  engineNumber: string
  logbookRef: string
  odometerKm: number
  status: Status
  statusLabel: string
  compliance: Compliance
  driver: Driver
  authorisedDrivers: { name: string; initials: string; tone: DriverTone; role: string; badge: "Driving" | "Idle" }[]
  mtdSpend: number
  renewalFee: number
  activeTrip: ActiveTrip
  recentTrips: RecentTrip[]
  documents: DocumentRow[]
  complianceSeries: ComplianceCellState[]
  trackingDevice: TrackingDevice | null
  /** YYYY-MM marker of the last fully-paid Circulation Licence period; used to flag a duplicate-month attempt. */
  lastPaidPeriod?: string
}

const buildSeries = (seed: number): ComplianceCellState[] => {
  const out: ComplianceCellState[] = []
  let s = seed
  for (let i = 0; i < 365; i++) {
    s = (s * 1664525 + 1013904223) % 0xffffffff
    const r = (s >>> 0) / 0xffffffff
    if (r < 0.05) out.push("alert")
    else if (r < 0.55) out.push("paid")
    else out.push("idle")
  }
  return out
}

const driverPool = {
  joao: { name: "João Macuácua", initials: "JM", tone: "green" as const, role: "Primary · Heavy-duty C", badge: "Driving" as const },
  ana: { name: "Ana Cossa", initials: "AC", tone: "cream" as const, role: "Primary · Heavy-duty B", badge: "Idle" as const },
  rui: { name: "Rui Tembe", initials: "RT", tone: "blue" as const, role: "Primary · Heavy-duty C", badge: "Driving" as const },
  maria: { name: "Maria Banze", initials: "MB", tone: "green" as const, role: "Primary · Heavy-duty B", badge: "Idle" as const },
  paulo: { name: "Paulo Sitoe", initials: "PS", tone: "blue" as const, role: "Backup · Heavy-duty B", badge: "Idle" as const },
}

export const FLEET: Vehicle[] = [
  {
    plate: "AAB 482 MC",
    ref: "TRK-100184-01",
    model: "Volvo FH16",
    year: 2021,
    axles: 4,
    configuration: "4×2 articulated",
    weightKg: 36_500,
    color: "White",
    rucClass: "RESTRICTED_HEAVY",
    chassisVin: "WMA12345VLB098765",
    engineNumber: "D16K540-9X23-44128",
    logbookRef: "MVR-2021-887341",
    odometerKm: 184_500,
    status: "active",
    statusLabel: "Active trip",
    compliance: { kind: "compliant", expDate: "12 Aug 2026" },
    driver: { name: "João Macuácua", initials: "JM", tone: "green" },
    authorisedDrivers: [driverPool.joao, driverPool.paulo],
    mtdSpend: 22_500,
    renewalFee: 3_000,
    activeTrip: {
      id: "TX-08471",
      dayCurrent: 2,
      dayTotal: 5,
      startsAt: "Mon 4 May · 00:00",
      endsAt: "Fri 8 May · 23:59",
      licenceLabel: "Cargo licence · 25–38 t · ends Fri 8 May",
    },
    recentTrips: [
      { id: "TX-08471", start: "4 May", end: "8 May", durationDays: 5, driver: "João Macuácua", charge: 15_000, status: "active" },
      { id: "TX-08402", start: "22 Apr", end: "24 Apr", durationDays: 3, driver: "João Macuácua", charge: 9_000, status: "closed" },
      { id: "TX-08355", start: "10 Apr", end: "12 Apr", durationDays: 2, driver: "Paulo Sitoe", charge: 6_000, status: "closed" },
      { id: "TX-08291", start: "28 Mar", end: "1 Apr", durationDays: 5, driver: "João Macuácua", charge: 15_000, status: "closed" },
    ],
    documents: [
      { key: "logbook", title: "Logbook (MVR)", subtitle: "Verified · synced 4 May", state: "ok" },
      { key: "circulation", title: "Circulation licence", subtitle: "Valid until 12 Aug 2026", state: "ok" },
      { key: "insurance", title: "Insurance certificate", subtitle: "Expires in 38 days", state: "warning" },
      { key: "photos", title: "Vehicle photos", subtitle: "6 of 6 angles uploaded", state: "ok" },
    ],
    complianceSeries: buildSeries(11),
    trackingDevice: {
      deviceId: "DEV-MP-100184-01",
      imei: "352093085729417",
      model: "Teltonika FMB920",
      firmwareVersion: "03.27.16",
      protocol: "TCP",
      status: "ACTIVE",
      lastSeenAt: "2026-05-04T09:42:00Z",
      sealNumber: "SEAL-MZ-44128",
      installedAt: "2024-08-12T11:30:00Z",
      installedBy: "TECH-MZ-018",
      simIccid: "8925801203012094188",
      apn: "internet.movitel.co.mz",
    },
  },
  {
    plate: "AAJ 119 MC",
    ref: "TRK-100184-02",
    model: "Scania R450",
    year: 2019,
    axles: 4,
    configuration: "4×2 rigid",
    weightKg: 28_200,
    color: "Red",
    rucClass: "RESTRICTED_HEAVY",
    chassisVin: "YS2R6X20002188123",
    engineNumber: "DC13-450-22Q-77119",
    logbookRef: "MVR-2019-554209",
    odometerKm: 268_400,
    status: "idle",
    statusLabel: "Idle · Beira yard",
    compliance: { kind: "renewal-soon", daysLeft: 4, expDate: "8 May 2026" },
    driver: { name: "Ana Cossa", initials: "AC", tone: "cream" },
    authorisedDrivers: [driverPool.ana],
    mtdSpend: 11_000,
    renewalFee: 4_000,
    activeTrip: null,
    recentTrips: [
      { id: "TX-08188", start: "12 Apr", end: "14 Apr", durationDays: 2, driver: "Ana Cossa", charge: 6_000, status: "closed" },
      { id: "TX-08099", start: "2 Apr", end: "5 Apr", durationDays: 3, driver: "Ana Cossa", charge: 9_000, status: "closed" },
    ],
    documents: [
      { key: "logbook", title: "Logbook (MVR)", subtitle: "Verified · synced 28 Apr", state: "ok" },
      { key: "circulation", title: "Circulation licence", subtitle: "Renewal in 4 days", state: "warning" },
      { key: "insurance", title: "Insurance certificate", subtitle: "Valid until 4 Mar 2027", state: "ok" },
      { key: "photos", title: "Vehicle photos", subtitle: "6 of 6 angles uploaded", state: "ok" },
    ],
    complianceSeries: buildSeries(23),
    trackingDevice: {
      deviceId: "DEV-MP-100184-02",
      imei: "861256048591023",
      model: "Concox GT06N",
      firmwareVersion: "BR-90-V2.4",
      protocol: "TCP",
      status: "OFFLINE",
      lastSeenAt: "2026-05-03T18:14:00Z",
      sealNumber: "SEAL-MZ-77119",
      installedAt: "2023-11-04T08:00:00Z",
      installedBy: "TECH-MZ-022",
      simIccid: "8925801203012094209",
      apn: "internet.tmcel.co.mz",
    },
  },
  {
    plate: "ABT 770 MC",
    ref: "TRK-100184-03",
    model: "MAN TGS",
    year: 2022,
    axles: 3,
    configuration: "6×2 rigid",
    weightKg: 19_800,
    color: "Blue",
    rucClass: "MEDIUM_HEAVY",
    chassisVin: "WMAH09ZZ4NL097742",
    engineNumber: "D2676-LF26-7X-44102",
    logbookRef: "MVR-2022-998112",
    odometerKm: 96_300,
    status: "idle",
    statusLabel: "Idle · Maputo HQ",
    compliance: { kind: "compliant", expDate: "3 Nov 2026" },
    driver: null,
    authorisedDrivers: [driverPool.maria],
    mtdSpend: 6_000,
    renewalFee: 1_000,
    activeTrip: null,
    recentTrips: [
      { id: "TX-07932", start: "18 Apr", end: "19 Apr", durationDays: 1, driver: "Maria Banze", charge: 1_000, status: "closed" },
    ],
    documents: [
      { key: "logbook", title: "Logbook (MVR)", subtitle: "Verified · synced 1 May", state: "ok" },
      { key: "circulation", title: "Circulation licence", subtitle: "Valid until 3 Nov 2026", state: "ok" },
      { key: "insurance", title: "Insurance certificate", subtitle: "Valid until 12 Sep 2026", state: "ok" },
      { key: "photos", title: "Vehicle photos", subtitle: "6 of 6 angles uploaded", state: "ok" },
    ],
    complianceSeries: buildSeries(31),
    trackingDevice: {
      deviceId: "DEV-MP-100184-03",
      imei: "352093085729511",
      model: "Teltonika FMC130",
      firmwareVersion: "01.06.04",
      protocol: "MQTT",
      status: "ACTIVE",
      lastSeenAt: "2026-05-04T10:11:00Z",
      sealNumber: "SEAL-MZ-44102",
      installedAt: "2025-02-19T14:00:00Z",
      installedBy: "TECH-MZ-018",
      simIccid: "8925801203012094317",
      apn: "internet.movitel.co.mz",
    },
    lastPaidPeriod: "2026-05",
  },
  {
    plate: "ABK 305 MC",
    ref: "TRK-100184-04",
    model: "Mercedes Actros",
    year: 2020,
    axles: 5,
    configuration: "6×4 articulated",
    weightKg: 43_500,
    color: "Silver",
    rucClass: "RESTRICTED_HEAVY",
    chassisVin: "WDB9634032L305881",
    engineNumber: "OM471LA-510-3X-22049",
    logbookRef: "MVR-2020-330541",
    odometerKm: 312_900,
    status: "active",
    statusLabel: "Active trip",
    compliance: { kind: "compliant", expDate: "21 Jan 2027" },
    driver: { name: "Rui Tembe", initials: "RT", tone: "blue" },
    authorisedDrivers: [driverPool.rui],
    mtdSpend: 28_000,
    renewalFee: 5_000,
    activeTrip: {
      id: "TX-08502",
      dayCurrent: 1,
      dayTotal: 3,
      startsAt: "Tue 5 May · 00:00",
      endsAt: "Thu 7 May · 23:59",
      licenceLabel: "Cargo licence · 38–48 t · ends Thu 7 May",
    },
    recentTrips: [
      { id: "TX-08502", start: "5 May", end: "7 May", durationDays: 3, driver: "Rui Tembe", charge: 12_000, status: "active" },
      { id: "TX-08410", start: "21 Apr", end: "25 Apr", durationDays: 4, driver: "Rui Tembe", charge: 16_000, status: "closed" },
    ],
    documents: [
      { key: "logbook", title: "Logbook (MVR)", subtitle: "Verified · synced 3 May", state: "ok" },
      { key: "circulation", title: "Circulation licence", subtitle: "Valid until 21 Jan 2027", state: "ok" },
      { key: "insurance", title: "Insurance certificate", subtitle: "Valid until 9 Oct 2026", state: "ok" },
      { key: "photos", title: "Vehicle photos", subtitle: "6 of 6 angles uploaded", state: "ok" },
    ],
    complianceSeries: buildSeries(47),
    trackingDevice: {
      deviceId: "DEV-MP-100184-04",
      imei: "861256048591558",
      model: "Teltonika FMB920",
      firmwareVersion: "03.27.16",
      protocol: "TCP",
      status: "ACTIVE",
      lastSeenAt: "2026-05-04T10:08:00Z",
      sealNumber: "SEAL-MZ-22049",
      installedAt: "2024-04-30T09:15:00Z",
      installedBy: "TECH-MZ-007",
      simIccid: "8925801203012094501",
      apn: "internet.movitel.co.mz",
    },
  },
  {
    plate: "AAH 220 MC",
    ref: "TRK-100184-05",
    model: "Iveco Stralis",
    year: 2019,
    axles: 4,
    configuration: "4×2 articulated",
    weightKg: 35_500,
    color: "Yellow",
    rucClass: "RESTRICTED_HEAVY",
    chassisVin: "ZCFA1NM0102554981",
    engineNumber: "F3GFE611B-XB-33092",
    logbookRef: "MVR-2019-771203",
    odometerKm: 244_700,
    status: "idle",
    statusLabel: "Idle · Maputo HQ",
    compliance: { kind: "compliant", expDate: "18 Sep 2026" },
    driver: { name: "Maria Banze", initials: "MB", tone: "green" },
    authorisedDrivers: [driverPool.maria],
    mtdSpend: 14_000,
    renewalFee: 2_000,
    activeTrip: null,
    recentTrips: [
      { id: "TX-08214", start: "16 Apr", end: "18 Apr", durationDays: 2, driver: "Maria Banze", charge: 6_000, status: "closed" },
    ],
    documents: [
      { key: "logbook", title: "Logbook (MVR)", subtitle: "Verified · synced 30 Apr", state: "ok" },
      { key: "circulation", title: "Circulation licence", subtitle: "Valid until 18 Sep 2026", state: "ok" },
      { key: "insurance", title: "Insurance certificate", subtitle: "Valid until 24 Nov 2026", state: "ok" },
      { key: "photos", title: "Vehicle photos", subtitle: "6 of 6 angles uploaded", state: "ok" },
    ],
    complianceSeries: buildSeries(59),
    trackingDevice: {
      deviceId: "DEV-MP-100184-05",
      imei: "352093085730022",
      model: "Concox JM-VL03",
      firmwareVersion: "VL03-CN-V1.8",
      protocol: "TCP",
      status: "REQUIRES_INSPECTION",
      lastSeenAt: "2026-05-02T22:45:00Z",
      sealNumber: "SEAL-MZ-33092",
      installedAt: "2023-09-08T10:00:00Z",
      installedBy: "TECH-MZ-022",
      simIccid: "8925801203012094666",
      apn: "internet.tmcel.co.mz",
    },
  },
  {
    plate: "ACX 014 MC",
    ref: "TRK-100184-06",
    model: "Volvo FMX",
    year: 2023,
    axles: 5,
    configuration: "6×4 articulated",
    weightKg: 43_000,
    color: "Green",
    rucClass: "RESTRICTED_HEAVY",
    chassisVin: "YV2RTC0D8PA014812",
    engineNumber: "D13K540-7X-99114",
    logbookRef: "MVR-2023-114902",
    odometerKm: 51_200,
    status: "active",
    statusLabel: "Active trip · Beira corridor",
    compliance: { kind: "compliant", expDate: "4 Dec 2026" },
    driver: { name: "João Macuácua", initials: "JM", tone: "green" },
    authorisedDrivers: [driverPool.joao],
    mtdSpend: 19_000,
    renewalFee: 3_000,
    activeTrip: {
      id: "TX-08488",
      dayCurrent: 3,
      dayTotal: 4,
      startsAt: "Sun 3 May · 04:00",
      endsAt: "Wed 6 May · 22:00",
      licenceLabel: "Cargo licence · 25–38 t · Beira corridor",
    },
    recentTrips: [
      { id: "TX-08488", start: "3 May", end: "6 May", durationDays: 4, driver: "João Macuácua", charge: 12_000, status: "active" },
    ],
    documents: [
      { key: "logbook", title: "Logbook (MVR)", subtitle: "Verified · synced 2 May", state: "ok" },
      { key: "circulation", title: "Circulation licence", subtitle: "Valid until 4 Dec 2026", state: "ok" },
      { key: "insurance", title: "Insurance certificate", subtitle: "Valid until 18 Jul 2026", state: "ok" },
      { key: "photos", title: "Vehicle photos", subtitle: "6 of 6 angles uploaded", state: "ok" },
    ],
    complianceSeries: buildSeries(67),
    trackingDevice: {
      deviceId: "DEV-MP-100184-06",
      imei: "352093085730177",
      model: "Teltonika FMC130",
      firmwareVersion: "01.06.04",
      protocol: "MQTT",
      status: "ACTIVE",
      lastSeenAt: "2026-05-04T10:18:00Z",
      sealNumber: "SEAL-MZ-99114",
      installedAt: "2024-12-02T13:20:00Z",
      installedBy: "TECH-MZ-018",
      simIccid: "8925801203012094812",
      apn: "internet.movitel.co.mz",
    },
  },
  {
    plate: "ZAB 217 MC",
    ref: "TRK-100184-07",
    model: "Hino 700",
    year: 2018,
    axles: 2,
    configuration: "4×2 rigid",
    weightKg: 11_400,
    color: "Orange",
    rucClass: "LIGHT_HEAVY",
    chassisVin: "JHFFP1JLP00217331",
    engineNumber: "E13C-VS-99-71203",
    logbookRef: "MVR-2018-220914",
    odometerKm: 412_800,
    status: "maintenance",
    statusLabel: "Maintenance · Maputo HQ",
    compliance: { kind: "expired", expDate: "1 May 2026" },
    driver: null,
    authorisedDrivers: [],
    mtdSpend: 1_500,
    renewalFee: 1_000,
    activeTrip: null,
    recentTrips: [],
    documents: [
      { key: "logbook", title: "Logbook (MVR)", subtitle: "Verified · synced 18 Apr", state: "ok" },
      { key: "circulation", title: "Circulation licence", subtitle: "Expired 1 May", state: "critical" },
      { key: "insurance", title: "Insurance certificate", subtitle: "Expired 2 May", state: "critical" },
      { key: "photos", title: "Vehicle photos", subtitle: "5 of 6 angles uploaded", state: "warning" },
    ],
    complianceSeries: buildSeries(73),
    trackingDevice: {
      deviceId: "DEV-MP-100184-07",
      imei: "861256048591890",
      model: "Concox GT06N",
      firmwareVersion: "BR-90-V2.4",
      protocol: "TCP",
      status: "DECOMMISSIONED",
      lastSeenAt: "2026-04-29T07:32:00Z",
      sealNumber: "SEAL-MZ-71203",
      installedAt: "2022-06-14T11:45:00Z",
      installedBy: "TECH-MZ-022",
      simIccid: "8925801203012095104",
      apn: "internet.tmcel.co.mz",
    },
  },
  {
    plate: "AVS 992 MC",
    ref: "TRK-100184-08",
    model: "Scania P310",
    year: 2017,
    axles: 3,
    configuration: "6×2 rigid",
    weightKg: 22_000,
    color: "Black",
    rucClass: "MEDIUM_HEAVY",
    chassisVin: "YS2P6X20003992771",
    engineNumber: "DC09-310-8X-29903",
    logbookRef: "MVR-2017-880102",
    odometerKm: 488_500,
    status: "idle",
    statusLabel: "Idle · Maputo HQ",
    compliance: { kind: "overdue", daysOverdue: 12, expDate: "22 Apr 2026", penaltyDailyMzn: 200 },
    driver: null,
    authorisedDrivers: [],
    mtdSpend: 0,
    renewalFee: 2_000,
    activeTrip: null,
    recentTrips: [],
    documents: [
      { key: "logbook", title: "Logbook (MVR)", subtitle: "Verified · synced 4 Apr", state: "ok" },
      { key: "circulation", title: "Circulation licence", subtitle: "Overdue · 12 days", state: "critical" },
      { key: "insurance", title: "Insurance certificate", subtitle: "Valid until 9 Jul 2026", state: "ok" },
      { key: "photos", title: "Vehicle photos", subtitle: "4 of 6 angles uploaded", state: "warning" },
    ],
    complianceSeries: buildSeries(89),
    trackingDevice: {
      deviceId: "DEV-MP-100184-08",
      imei: "352093085730301",
      model: "Teltonika FMB920",
      firmwareVersion: "03.27.16",
      protocol: "TCP",
      status: "TAMPERED",
      lastSeenAt: "2026-05-01T03:08:00Z",
      sealNumber: "SEAL-MZ-29903",
      installedAt: "2023-03-22T09:00:00Z",
      installedBy: "TECH-MZ-007",
      simIccid: "8925801203012095288",
      apn: "internet.movitel.co.mz",
    },
  },
]

export type WeightTier = {
  key: "8-16" | "16-25" | "25-38" | "38-48" | "48+"
  label: string
  rangeLabel: string
  minKg: number
  maxKg: number
  mznPerDay: number
}

export const WEIGHT_TIERS: WeightTier[] = [
  { key: "8-16", label: "8–16t", rangeLabel: "8,000–16,000 kg", minKg: 8_000, maxKg: 16_000, mznPerDay: 1_000 },
  { key: "16-25", label: "16–25t", rangeLabel: "16,001–25,000 kg", minKg: 16_001, maxKg: 25_000, mznPerDay: 2_000 },
  { key: "25-38", label: "25–38t", rangeLabel: "25,001–38,000 kg", minKg: 25_001, maxKg: 38_000, mznPerDay: 3_000 },
  { key: "38-48", label: "38–48t", rangeLabel: "38,001–48,000 kg", minKg: 38_001, maxKg: 48_000, mznPerDay: 4_000 },
  { key: "48+", label: ">48t", rangeLabel: ">48,001 kg", minKg: 48_001, maxKg: 80_000, mznPerDay: 5_000 },
]

export function weightTierForKg(kg: number): WeightTier | null {
  if (!Number.isFinite(kg) || kg < WEIGHT_TIERS[0].minKg) return null
  return (
    WEIGHT_TIERS.find((t) => kg >= t.minKg && kg <= t.maxKg) ??
    WEIGHT_TIERS[WEIGHT_TIERS.length - 1]
  )
}

export function tierMidpoint(tier: WeightTier): number {
  return Math.round((tier.minKg + tier.maxKg) / 2)
}

export function formatMzn(n: number): string {
  return n.toLocaleString("en-US")
}

export function normalisePlate(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, " ")
}

export function findVehicleByPlate(plate: string): Vehicle | undefined {
  const norm = normalisePlate(plate)
  return FLEET.find((v) => v.plate === norm)
}

export function plateExists(plate: string): boolean {
  return findVehicleByPlate(plate) !== undefined
}

export type MvrLookupResult =
  | {
      kind: "found"
      data: {
        plate: string
        logbookRef: string
        makeModel: string
        year: number
        chassisVin: string
        engineNumber: string
        axles: number
        weightKg: number
      }
    }
  | { kind: "not-found"; plate: string }

export function mvrLookup(rawPlate: string): Promise<MvrLookupResult> {
  const plate = normalisePlate(rawPlate)
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!plate) {
        resolve({ kind: "not-found", plate })
        return
      }
      if (plate === "AKM 902 MC") {
        resolve({
          kind: "found",
          data: {
            plate,
            logbookRef: "MVR-2021-887341",
            makeModel: "Volvo FH16 540",
            year: 2021,
            chassisVin: "WMA12345VLB098765",
            engineNumber: "D16K540-9X23-44128",
            axles: 4,
            weightKg: 32_500,
          },
        })
        return
      }
      if (/^[A-Z]{3} \d{3} MC$/.test(plate)) {
        resolve({
          kind: "found",
          data: {
            plate,
            logbookRef: `MVR-2024-${Math.floor(100000 + Math.random() * 800000)}`,
            makeModel: "Volvo FH16 540",
            year: 2024,
            chassisVin: "WMA00000VLB000000",
            engineNumber: "D16K540-0X00-00000",
            axles: 4,
            weightKg: 30_000,
          },
        })
        return
      }
      resolve({ kind: "not-found", plate })
    }, 600)
  })
}

// ── Penalties, receipts, payment simulation ──────────────────────────────────

export type Receipt = {
  number: string
  issuedAt: string
  vehiclePlate: string
  vehicleModel: string
  category: string
  durationDays: number
  rangeFromIso: string
  rangeToIso: string
  subtotalMzn: number
  penaltyMzn: number
  capAdjustmentMzn: number
  totalMzn: number
  channel: PaymentChannel
  channelLabel: string
  status: "paid" | "pending-reconciliation"
  qrPayload: string
}

export type PaymentResult =
  | { kind: "success"; receipt: Receipt }
  | { kind: "pending"; receipt: Receipt }
  | { kind: "failure"; reason: string; retryable: boolean }

/** Deterministic test plate that always fails — exposed so QA can demo A2. */
export const FAILING_TEST_PLATE = "AVS 992 MC"

export function calculatePenalty(v: Vehicle): number {
  return v.compliance.kind === "overdue"
    ? v.compliance.daysOverdue * v.compliance.penaltyDailyMzn
    : 0
}

let receiptCounter = 4188
export function nextReceiptNumber(): string {
  receiptCounter += 1
  return `RCT-2026-0${receiptCounter}`
}

export type ReceiptInput = {
  vehicle: Vehicle
  category: string
  durationDays: number
  rangeFromIso: string
  rangeToIso: string
  subtotalMzn: number
  penaltyMzn: number
  capAdjustmentMzn: number
  totalMzn: number
  channel: PaymentChannel
  channelLabel: string
  status: "paid" | "pending-reconciliation"
}

export function generateReceipt(input: ReceiptInput): Receipt {
  const number = nextReceiptNumber()
  const issuedAt = new Date().toISOString()
  return {
    number,
    issuedAt,
    vehiclePlate: input.vehicle.plate,
    vehicleModel: input.vehicle.model,
    category: input.category,
    durationDays: input.durationDays,
    rangeFromIso: input.rangeFromIso,
    rangeToIso: input.rangeToIso,
    subtotalMzn: input.subtotalMzn,
    penaltyMzn: input.penaltyMzn,
    capAdjustmentMzn: input.capAdjustmentMzn,
    totalMzn: input.totalMzn,
    channel: input.channel,
    channelLabel: input.channelLabel,
    status: input.status,
    qrPayload: `RUC:${number}:${input.vehicle.plate.replace(/\s+/g, "")}:${input.totalMzn}`,
  }
}

export function simulatePaymentResult(
  input: ReceiptInput,
): Promise<PaymentResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (input.vehicle.plate === FAILING_TEST_PLATE) {
        resolve({
          kind: "failure",
          reason: "Issuer declined: insufficient operating credit at gateway. Try a different method.",
          retryable: true,
        })
        return
      }
      if (input.channel === "bank") {
        resolve({
          kind: "pending",
          receipt: generateReceipt({ ...input, status: "pending-reconciliation" }),
        })
        return
      }
      resolve({
        kind: "success",
        receipt: generateReceipt({ ...input, status: "paid" }),
      })
    }, 1500)
  })
}
