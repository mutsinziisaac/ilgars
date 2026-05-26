import { useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Download,
  RefreshCw,
  Truck,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import QRCode from "react-qr-code"
import { toPng } from "html-to-image"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusPill } from "@/components/fleet/status-pill"
import {
  getMyFleetVehicles,
  type MyFleetItem,
  type MyFleetViolation,
} from "@/lib/fleet-vehicles-api"
import { formatDateValue } from "@/i18n/format"
import {
  formatViolationAmount,
  isOpenViolation,
  violationCodeLabel,
  violationStatusLabel,
  violationStatusTone,
} from "@/lib/violations"
import { capacityClassLabel } from "@/lib/fleet-vehicle-classification"
import {
  formatMzn,
  WEIGHT_TIERS,
  weightTierForKg,
  type WeightTier,
} from "@/lib/fleet"
import { getTripsByVehicleId, type VehicleTrip } from "@/lib/trips-api"
import { cn } from "@/lib/utils"

const FLEET_VEHICLES_QUERY_KEY = ["myfleet", "ACTIVE"] as const

const VEHICLE_IMAGES = [
  "/vehicle-weight-8-16.png",
  "/vehicle-weight-16-25.png",
  "/vehicle-weight-25-38.png",
  "/vehicle-weight-38-48.png",
  "/vehicle-weight-48-plus.png",
] as const

const VEHICLE_IMAGE_BY_TIER: Record<WeightTier["key"], (typeof VEHICLE_IMAGES)[number]> = {
  "8-16": VEHICLE_IMAGES[0],
  "16-25": VEHICLE_IMAGES[1],
  "25-38": VEHICLE_IMAGES[2],
  "38-48": VEHICLE_IMAGES[3],
  "48+": VEHICLE_IMAGES[4],
}

function snapshotWeightKg(
  capacity: number | null | undefined,
  unit: string | null | undefined
): number {
  if (!capacity || !Number.isFinite(capacity) || capacity <= 0) return 0
  const upper = (unit ?? "").toUpperCase()
  if (upper === "KG") return Math.round(capacity)
  if (upper === "TONNES" || upper === "TONS" || upper === "T")
    return Math.round(capacity * 1000)
  return capacity <= 200 ? Math.round(capacity * 1000) : Math.round(capacity)
}

function vehicleImageForSnapshot(
  capacity: number | null | undefined,
  unit: string | null | undefined
): string {
  const kg = snapshotWeightKg(capacity, unit)
  const tier = weightTierForKg(kg) ?? WEIGHT_TIERS[0]
  return VEHICLE_IMAGE_BY_TIER[tier.key]
}
const DAY_MS = 24 * 60 * 60 * 1000

type LocationState = {
  fleetVehicle?: MyFleetItem
  vehicle?: MyFleetItem
}

function statusLabel(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return "-"
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatCapacity(item: MyFleetItem) {
  const capacity = item.vehicle.capacity
  if (typeof capacity !== "number" || !Number.isFinite(capacity)) return "-"
  return `${capacity.toLocaleString()} kg`
}

function tripDuration(trip: VehicleTrip) {
  const days = trip.expectedDurationDays
  return typeof days === "number" && Number.isFinite(days) ? `${days}d` : "-"
}

function formatAmount(value: unknown) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return "-"
  return `${formatMzn(amount)} MZN`
}

function numberField(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value : null
}

function firstStringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = stringField(record[key])
    if (value) return value
  }
  return null
}

function firstFeeDate(trip: VehicleTrip, key: "coverageStart" | "coverageEnd") {
  const payment = trip.payment
  if (!payment || typeof payment !== "object" || !("fees" in payment))
    return null
  const fees = (payment as { fees?: unknown }).fees
  if (!Array.isArray(fees)) return null

  for (const fee of fees) {
    if (!fee || typeof fee !== "object") continue
    const value = stringField((fee as Record<string, unknown>)[key])
    if (value) return value
  }

  return null
}

function tripStartDate(trip: VehicleTrip) {
  return (
    firstStringField(trip, [
      "startAt",
      "startsAt",
      "startedAt",
      "expectedStartAt",
      "coverageStart",
    ]) ?? firstFeeDate(trip, "coverageStart")
  )
}

function tripEndDate(trip: VehicleTrip) {
  return (
    firstStringField(trip, [
      "endAt",
      "endsAt",
      "endedAt",
      "expectedEndAt",
      "coverageEnd",
    ]) ?? firstFeeDate(trip, "coverageEnd")
  )
}

function tripDateLabel(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return formatDateValue(date, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function parseTripDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function tripPaymentMode(trip: VehicleTrip) {
  const nested = trip.payment
  const value =
    nested && typeof nested === "object"
      ? stringField((nested as Record<string, unknown>).paymentMode)
      : null
  return value ?? trip.paymentMode
}

function isPostpaidTrip(trip: VehicleTrip) {
  return tripPaymentMode(trip).toUpperCase() === "POSTPAID"
}

function tripOutstandingAmount(trip: VehicleTrip) {
  const nested = trip.payment
  const nestedAmount =
    nested && typeof nested === "object"
      ? numberField((nested as Record<string, unknown>).outstandingFeeAmount)
      : null
  return nestedAmount ?? numberField(trip.outstandingFeeAmount) ?? 0
}

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "")
}

function tripCoverage(trip: VehicleTrip, now = new Date()) {
  const start = parseTripDate(tripStartDate(trip))
  const end = parseTripDate(tripEndDate(trip))
  if (!start || !end) return null
  if (now.getTime() < start.getTime() || now.getTime() > end.getTime()) {
    return null
  }

  const durationFromTrip =
    typeof trip.expectedDurationDays === "number" &&
    Number.isFinite(trip.expectedDurationDays)
      ? Math.max(1, Math.ceil(trip.expectedDurationDays))
      : null
  const durationFromDates = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / DAY_MS)
  )
  const totalDays = durationFromTrip ?? durationFromDates
  const coveredDays = Math.min(
    totalDays,
    Math.max(1, Math.floor((now.getTime() - start.getTime()) / DAY_MS) + 1)
  )

  return {
    start,
    end,
    totalDays,
    coveredDays,
    remainingDays: Math.max(0, totalDays - coveredDays),
  }
}

function findCurrentTrip(trips: VehicleTrip[]) {
  const now = new Date()
  return trips
    .map((trip) => ({ trip, coverage: tripCoverage(trip, now) }))
    .filter(
      (
        entry
      ): entry is {
        trip: VehicleTrip
        coverage: NonNullable<ReturnType<typeof tripCoverage>>
      } => entry.coverage !== null
    )
    .sort((a, b) => {
      const statusA = a.trip.status.toUpperCase()
      const statusB = b.trip.status.toUpperCase()
      const activeA = statusA === "OPEN" || statusA === "ACTIVE"
      const activeB = statusB === "OPEN" || statusB === "ACTIVE"
      if (activeA !== activeB) return activeA ? -1 : 1
      return b.coverage.start.getTime() - a.coverage.start.getTime()
    })[0]
}

export default function VehicleDetail() {
  const { t } = useTranslation()
  const { vehicleId: routeVehicleId, plate: legacyPlate } = useParams<{
    vehicleId?: string
    plate?: string
  }>()
  const vehicleId = decodeURIComponent(routeVehicleId ?? legacyPlate ?? "")
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const state = location.state as LocationState | null
  const stateVehicle = state?.fleetVehicle ?? state?.vehicle
  const cachedVehicles =
    queryClient.getQueryData<MyFleetItem[]>(FLEET_VEHICLES_QUERY_KEY) ?? []

  const cachedVehicle = useMemo(
    () =>
      cachedVehicles.find(
        (item) =>
          item.vehicleId === vehicleId ||
          item.vehicle.vehicleId === vehicleId ||
          item.vehicle.plateNumber === vehicleId
      ),
    [cachedVehicles, vehicleId]
  )

  const fleetQuery = useQuery({
    queryKey: FLEET_VEHICLES_QUERY_KEY,
    queryFn: () => getMyFleetVehicles("ACTIVE"),
    enabled: !stateVehicle && !cachedVehicle,
  })

  const vehicle =
    stateVehicle ??
    cachedVehicle ??
    fleetQuery.data?.find(
      (item) =>
        item.vehicleId === vehicleId ||
        item.vehicle.vehicleId === vehicleId ||
        item.vehicle.plateNumber === vehicleId
    )

  const tripsQuery = useQuery({
    queryKey: ["trips", vehicle?.vehicleId ?? vehicle?.vehicle.vehicleId],
    queryFn: () =>
      getTripsByVehicleId(vehicle!.vehicleId || vehicle!.vehicle.vehicleId),
    enabled: !!(vehicle?.vehicleId || vehicle?.vehicle.vehicleId),
  })
  const trips = Array.isArray(tripsQuery.data) ? tripsQuery.data : []
  const allViolations = Array.isArray(vehicle?.violations)
    ? (vehicle?.violations as MyFleetViolation[])
    : []
  const openViolationCount = allViolations.filter(isOpenViolation).length

  if (!vehicle && fleetQuery.isLoading) {
    return (
      <Empty className="rounded-xl border border-border bg-card py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
          <EmptyTitle>{t("vehicleDetail.loadingVehicle")}</EmptyTitle>
          <EmptyDescription>
            {t("vehicleDetail.loadingVehicleDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (!vehicle) {
    return (
      <Empty className="rounded-xl border border-border bg-card py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Truck className="size-5" />
          </EmptyMedia>
          <EmptyTitle>{t("vehicleDetail.vehicleNotFound")}</EmptyTitle>
          <EmptyDescription>
            {t("vehicleDetail.vehicleNotFoundDescription", { vehicleId })}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            onClick={() => navigate("/portal/fleet")}
            className="rounded-md"
          >
            {t("common.backToFleet")}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <VehicleHeroCard vehicle={vehicle} />
        <TripActionCard vehicle={vehicle} trips={trips} />
      </div>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList variant="line" className="border-b border-border pb-1">
          <TabsTrigger value="overview">
            {t("vehicleDetail.overview")}
          </TabsTrigger>
          <TabsTrigger value="trips">
            {t("vehicleDetail.trips")}
            <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums">
              {tripsQuery.data?.length ?? 0}
            </span>
          </TabsTrigger>
          <TabsTrigger value="violations">
            {t("fleet.violations")}
            <span
              className={cn(
                "ml-1 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums",
                openViolationCount > 0
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {openViolationCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="activity">{t("common.activityLog")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 flex flex-col gap-4">
          {allViolations.length > 0 && (
            <ViolationsCard violations={allViolations} compact />
          )}
          <TripsCard
            vehicle={vehicle}
            trips={trips}
            isLoading={tripsQuery.isLoading}
            error={tripsQuery.error}
            onRetry={() => void tripsQuery.refetch()}
          />
        </TabsContent>

        <TabsContent value="trips" className="mt-0">
          <TripsCard
            vehicle={vehicle}
            trips={trips}
            isLoading={tripsQuery.isLoading}
            error={tripsQuery.error}
            onRetry={() => void tripsQuery.refetch()}
          />
        </TabsContent>

        <TabsContent value="violations" className="mt-0">
          <ViolationsCard violations={allViolations} />
        </TabsContent>

        <TabsContent value="activity" className="mt-0">
          <PlaceholderCard
            title={t("common.activityLog")}
            description={t("vehicleDetail.activityDescription")}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function VehicleHeroCard({ vehicle }: { vehicle: MyFleetItem }) {
  const { t } = useTranslation()
  const snapshot = vehicle.vehicle
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[200px_minmax(0,1fr)] md:items-center">
        <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40 md:h-36">
          <img
            src={vehicleImageForSnapshot(snapshot.capacity, snapshot.capacityUnit)}
            alt={snapshot.plateNumber}
            className="h-full w-full object-contain p-2"
          />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-2xl font-semibold tracking-wider text-foreground">
                {snapshot.plateNumber}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("vehicleDetail.truck")}{" "}
                <span className="font-mono">{snapshot.truckNumber ?? "-"}</span>{" "}
                · {t("common.vehicleId")}{" "}
                <span className="font-mono">
                  {vehicle.vehicleId || snapshot.vehicleId}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill tone="compliant">
                {t("vehicleDetail.savedFleet")}
              </StatusPill>
              <StatusPill tone="neutral">
                {statusLabel(vehicle.status)}
              </StatusPill>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-border bg-border md:grid-cols-4">
        <StatCell
          label={t("common.capacity")}
          value={formatCapacity(vehicle)}
        />
        <StatCell
          label={t("common.class")}
          value={capacityClassLabel({
            capacitySnapshot: snapshot.capacity ?? 0,
            capacityUnit: snapshot.capacityUnit ?? "TONNES",
          } as Parameters<typeof capacityClassLabel>[0])}
        />
        <StatCell
          label={t("common.registry")}
          value={statusLabel(snapshot.registryStatus)}
        />
        <StatCell
          label={t("common.status")}
          value={statusLabel(vehicle.status)}
        />
      </div>
    </section>
  )
}

function TripActionCard({
  vehicle,
  trips,
}: {
  vehicle: MyFleetItem
  trips: VehicleTrip[]
}) {
  const { t } = useTranslation()
  const vehicleId = vehicle.vehicleId || vehicle.vehicle.vehicleId
  const currentTrip = findCurrentTrip(trips)
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {t("vehicleDetail.roadUserCharge")}
      </p>
      {currentTrip ? (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">
                {t("vehicleDetail.currentCoverage")}
              </p>
              <p className="mt-0.5 font-mono text-xs text-foreground">
                {currentTrip.trip.id}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill tone="compliant">
                {t("vehicleDetail.dayOfDays", {
                  current: currentTrip.coverage.coveredDays,
                  total: currentTrip.coverage.totalDays,
                })}
              </StatusPill>
              {isPostpaidTrip(currentTrip.trip) && (
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-primary"
                >
                  {t("vehicleDetail.postpaid")}
                </Badge>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <StatMini
              label={t("vehicleDetail.covered")}
              value={t("common.days", {
                count: currentTrip.coverage.coveredDays,
              })}
            />
            <StatMini
              label={t("vehicleDetail.remaining")}
              value={t("common.days", {
                count: currentTrip.coverage.remainingDays,
              })}
            />
          </div>
          {isPostpaidTrip(currentTrip.trip) && (
            <p className="mt-3 text-xs font-medium text-primary">
              {t("vehicleDetail.postpaidAmount", {
                amount: formatAmount(tripOutstandingAmount(currentTrip.trip)),
              })}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {tripDateLabel(tripStartDate(currentTrip.trip))} -{" "}
            {tripDateLabel(tripEndDate(currentTrip.trip))}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("vehicleDetail.chargeDescription")}
        </p>
      )}
      <Button asChild size="sm" className="mt-auto w-fit rounded-md">
        <Link
          to={`/portal/pay-charges?vehicle=${encodeURIComponent(
            vehicle.vehicle.plateNumber
          )}&vehicleId=${encodeURIComponent(vehicleId)}&step=circulation`}
          state={{ fleetVehicle: vehicle }}
        >
          {t("shell.createTrip")}
          <ArrowRight />
        </Link>
      </Button>
    </section>
  )
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-card px-3 py-2">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-primary">{value}</p>
    </div>
  )
}

function StatCell({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="bg-card px-5 py-3">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold text-foreground",
          mono && "font-mono"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function TripsCard({
  vehicle,
  trips,
  isLoading,
  error,
  onRetry,
  compact = false,
}: {
  vehicle: MyFleetItem
  trips: VehicleTrip[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  compact?: boolean
}) {
  const { t } = useTranslation()
  const [selectedTrip, setSelectedTrip] = useState<VehicleTrip | null>(null)
  const visibleTrips = compact ? trips.slice(0, 5) : trips

  return (
    <>
      <section className="flex flex-col overflow-x-auto rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {t("vehicleDetail.trips")}
          </h3>
          <span className="text-xs text-muted-foreground">
            {t("vehicleDetail.total", { count: trips.length })}
          </span>
        </div>
        <div className="grid min-w-[1040px] grid-cols-[1.35fr_0.8fr_0.8fr_0.75fr_0.75fr_0.7fr_0.95fr_0.7fr_1.2fr] items-center gap-x-4 border-t border-border px-5 py-2 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          <span>{t("vehicleDetail.tripReason")}</span>
          <span>{t("common.status")}</span>
          <span>{t("vehicleDetail.billing")}</span>
          <span>{t("vehicleDetail.start")}</span>
          <span>{t("vehicleDetail.end")}</span>
          <span>{t("vehicleDetail.fees")}</span>
          <span>{t("vehicleDetail.outstanding")}</span>
          <span>{t("common.duration")}</span>
          <span>{t("vehicleDetail.payment")}</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 border-t border-border px-5 py-8 text-sm text-muted-foreground">
            <Spinner />
            {t("vehicleDetail.loadingTrips")}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 border-t border-border px-5 py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              {t("vehicleDetail.loadTripsFailed")}
            </p>
            <p className="text-xs text-muted-foreground">
              {error instanceof Error ? error.message : t("landing.tryAgain")}
            </p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="size-3.5" />
              {t("common.retry")}
            </Button>
          </div>
        ) : visibleTrips.length === 0 ? (
          <div className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
            {t("vehicleDetail.noTripsRecord")}
          </div>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {visibleTrips.map((trip, index) => (
              <li
                key={`${trip.id}-${index}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedTrip(trip)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    setSelectedTrip(trip)
                  }
                }}
                className="grid min-w-[1040px] cursor-pointer grid-cols-[1.35fr_0.8fr_0.8fr_0.75fr_0.75fr_0.7fr_0.95fr_0.7fr_1.2fr] items-center gap-x-4 px-5 py-3 outline-none hover:bg-muted/40 focus-visible:bg-muted/40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {trip.reason}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {trip.creationSource}
                  </span>
                </span>
                <span className="text-xs text-foreground">
                  {statusLabel(trip.status)}
                </span>
                <span className="text-xs text-foreground">
                  {statusLabel(trip.billingStatus)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tripDateLabel(tripStartDate(trip))}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tripDateLabel(tripEndDate(trip))}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("vehicleDetail.feeCount", { count: trip.feeCount })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatAmount(trip.outstandingFeeAmount)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tripDuration(trip)}
                </span>
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {tripPaymentMode(trip)} · {trip.createdBy}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <TripCertificateDialog
        vehicle={vehicle}
        trip={selectedTrip}
        onOpenChange={(open) => {
          if (!open) setSelectedTrip(null)
        }}
      />
    </>
  )
}

function ViolationsCard({
  violations,
  compact = false,
}: {
  violations: MyFleetViolation[]
  compact?: boolean
}) {
  const { t } = useTranslation()
  const openCount = violations.filter(isOpenViolation).length
  const visible = compact ? violations.filter(isOpenViolation) : violations

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {t("fleet.violations")}
          </h3>
          {openCount > 0 && (
            <StatusPill tone="critical">
              <AlertTriangle className="size-3" />
              {t("fleet.violationCount", { count: openCount })}
            </StatusPill>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {t("vehicleDetail.total", { count: violations.length })}
        </span>
      </div>
      {visible.length === 0 ? (
        <div className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
          {t("fleet.noViolations")}
        </div>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {visible.map((violation) => {
            const amount = formatViolationAmount(violation)
            const upperStatus = (violation.status ?? "").toUpperCase()
            // Don't surface "available"/"responding" as a status — only show
            // terminal statuses like resolved/released.
            const showStatus =
              upperStatus !== "AVAILABLE" && upperStatus !== "RESPONDING"
            const tone = violationStatusTone(violation.status)
            const assignment = violation.assignment ?? null
            const truckLoc = violation.truckLocation ?? null
            return (
              <li key={violation.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {violationCodeLabel(violation.code ?? violation.reason, t)}
                  </p>
                  {showStatus && (
                    <StatusPill tone={tone}>
                      {violationStatusLabel(violation.status, t)}
                    </StatusPill>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-3">
                  {amount && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("fleet.violationAmount")}
                      </dt>
                      <dd className="font-medium text-destructive">{amount}</dd>
                    </div>
                  )}
                  {violation.paymentMode && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("fleet.violationPaymentMode")}
                      </dt>
                      <dd className="text-foreground">
                        {statusLabel(violation.paymentMode)}
                      </dd>
                    </div>
                  )}
                  {violation.createdAt && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("fleet.violationCreatedAt")}
                      </dt>
                      <dd className="text-foreground">
                        {tripDateLabel(violation.createdAt)}
                      </dd>
                    </div>
                  )}
                  {violation.updatedAt && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("fleet.violationUpdatedAt")}
                      </dt>
                      <dd className="text-foreground">
                        {tripDateLabel(violation.updatedAt)}
                      </dd>
                    </div>
                  )}
                  {violation.tripId && (
                    <div className="sm:col-span-3">
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("fleet.violationTrip")}
                      </dt>
                      <dd className="break-all font-mono text-[11px] text-foreground">
                        {violation.tripId}
                      </dd>
                    </div>
                  )}
                  {truckLoc?.hasLocation &&
                    typeof truckLoc.latitude === "number" &&
                    typeof truckLoc.longitude === "number" && (
                      <div className="sm:col-span-3">
                        <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t("fleet.violationLocation")}
                        </dt>
                        <dd className="font-mono text-[11px] text-foreground">
                          {truckLoc.latitude.toFixed(5)},{" "}
                          {truckLoc.longitude.toFixed(5)}
                          {truckLoc.observedAt && (
                            <span className="ml-2 text-muted-foreground">
                              · {tripDateLabel(truckLoc.observedAt)}
                            </span>
                          )}
                        </dd>
                      </div>
                    )}
                  {assignment?.resolvedAt && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("fleet.violationResolvedAt")}
                      </dt>
                      <dd className="text-foreground">
                        {tripDateLabel(assignment.resolvedAt)}
                      </dd>
                    </div>
                  )}
                  {assignment?.releasedAt && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("fleet.violationReleasedAt")}
                      </dt>
                      <dd className="text-foreground">
                        {tripDateLabel(assignment.releasedAt)}
                      </dd>
                    </div>
                  )}
                </dl>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function TripCertificateDialog({
  vehicle,
  trip,
  onOpenChange,
}: {
  vehicle: MyFleetItem
  trip: VehicleTrip | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const certificateRef = useRef<HTMLDivElement | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const plate = vehicle.vehicle.plateNumber

  const downloadCertificate = async () => {
    if (!trip || !certificateRef.current) return
    setIsDownloading(true)
    try {
      const dataUrl = await toPng(certificateRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      })
      const link = document.createElement("a")
      link.download = `trip-certificate-${safeFilePart(trip.id) || "trip"}.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      link.remove()
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog open={trip !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("vehicleDetail.certificateTitle")}</DialogTitle>
          <DialogDescription>
            {t("vehicleDetail.certificateDescription")}
          </DialogDescription>
        </DialogHeader>
        {trip && (
          <div
            ref={certificateRef}
            className="relative mx-auto flex aspect-square w-full max-w-[420px] flex-col items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-card p-9 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)] ring-8 ring-primary/5"
          >
            <img
              src="/maputo-logo.webp"
              alt=""
              aria-hidden
              className="pointer-events-none absolute h-64 w-64 object-contain opacity-[0.12]"
            />
            <span className="relative flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <BadgeCheck className="size-5" />
            </span>
            <div className="relative mt-4 min-w-0">
              <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                {t("vehicleDetail.certificateEyebrow")}
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold tracking-wide text-foreground">
                {plate}
              </p>
              <p className="mt-1 font-mono text-xs font-medium text-foreground">
                {trip.id}
              </p>
              <p className="mx-auto mt-3 max-w-64 text-xs leading-snug text-muted-foreground">
                {statusLabel(trip.status)} · {statusLabel(trip.billingStatus)} ·{" "}
                {tripPaymentMode(trip)}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {tripDateLabel(tripStartDate(trip))} -{" "}
                {tripDateLabel(tripEndDate(trip))}
              </p>
              <p className="mt-1 text-xs font-medium text-foreground">
                {formatAmount(tripOutstandingAmount(trip))}
              </p>
            </div>
            <div className="relative mt-6 flex size-24 items-center justify-center rounded-full border border-border bg-background/95 p-4 shadow-sm">
              <QRCode
                value={trip.id}
                size={72}
                bgColor="transparent"
                fgColor="currentColor"
                title={t("vehicleDetail.qrTripId", { tripId: trip.id })}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            onClick={downloadCertificate}
            disabled={!trip || isDownloading}
            className="rounded-md"
          >
            {isDownloading ? <Spinner /> : <Download className="size-4" />}
            {t("vehicleDetail.downloadCertificate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PlaceholderCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card p-5">
      <Empty className="bg-card py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CheckCircle2 className="size-5" />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  )
}
