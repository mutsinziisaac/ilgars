import { useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, CheckCircle2, RefreshCw, Truck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
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
import { VehicleIllustration } from "@/components/fleet/vehicle-illustration"
import {
  getMyFleetVehicles,
  type MyFleetItem,
} from "@/lib/fleet-vehicles-api"
import { capacityClassLabel } from "@/lib/fleet-vehicle-classification"
import { formatMzn } from "@/lib/fleet"
import { getTripsByVehicleId, type VehicleTrip } from "@/lib/trips-api"
import { cn } from "@/lib/utils"

const FLEET_VEHICLES_QUERY_KEY = ["myfleet", "ACTIVE"] as const

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
  const unit = item.vehicle.capacityUnit ?? ""
  if (typeof capacity !== "number" || !Number.isFinite(capacity)) return "-"
  return `${capacity.toLocaleString()} ${unit}`.trim()
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
    queryFn: () => getTripsByVehicleId(vehicle!.vehicleId || vehicle!.vehicle.vehicleId),
    enabled: !!(vehicle?.vehicleId || vehicle?.vehicle.vehicleId),
  })
  const trips = Array.isArray(tripsQuery.data) ? tripsQuery.data : []

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
        <TripActionCard vehicle={vehicle} />
      </div>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList variant="line" className="border-b border-border pb-1">
          <TabsTrigger value="overview">{t("vehicleDetail.overview")}</TabsTrigger>
          <TabsTrigger value="trips">
            {t("vehicleDetail.trips")}
            <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums">
              {tripsQuery.data?.length ?? 0}
            </span>
          </TabsTrigger>
          <TabsTrigger value="activity">{t("common.activityLog")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <TripsCard
            trips={trips}
            isLoading={tripsQuery.isLoading}
            error={tripsQuery.error}
            onRetry={() => void tripsQuery.refetch()}
          />
        </TabsContent>

        <TabsContent value="trips" className="mt-0">
          <TripsCard
            trips={trips}
            isLoading={tripsQuery.isLoading}
            error={tripsQuery.error}
            onRetry={() => void tripsQuery.refetch()}
          />
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
        <VehicleIllustration
          axles={4}
          size="lg"
          hatched
          className="h-32 w-full md:h-36"
        />
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
                <span className="font-mono">{vehicle.vehicleId || snapshot.vehicleId}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill tone="compliant">{t("vehicleDetail.savedFleet")}</StatusPill>
              <StatusPill tone="neutral">
                {statusLabel(vehicle.status)}
              </StatusPill>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-border bg-border md:grid-cols-4">
        <StatCell label={t("common.capacity")} value={formatCapacity(vehicle)} />
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
        <StatCell label={t("common.status")} value={statusLabel(vehicle.status)} />
      </div>
    </section>
  )
}

function TripActionCard({ vehicle }: { vehicle: MyFleetItem }) {
  const { t } = useTranslation()
  const vehicleId = vehicle.vehicleId || vehicle.vehicle.vehicleId
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {t("vehicleDetail.roadUserCharge")}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("vehicleDetail.chargeDescription")}
      </p>
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
  trips,
  isLoading,
  error,
  onRetry,
  compact = false,
}: {
  trips: VehicleTrip[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  compact?: boolean
}) {
  const { t } = useTranslation()
  const visibleTrips = compact ? trips.slice(0, 5) : trips

  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {t("vehicleDetail.trips")}
        </h3>
        <span className="text-xs text-muted-foreground">
          {t("vehicleDetail.total", { count: trips.length })}
        </span>
      </div>
      <div className="grid grid-cols-[1.35fr_0.8fr_0.8fr_0.7fr_0.95fr_0.7fr_1.2fr] items-center gap-x-4 border-t border-border px-5 py-2 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        <span>{t("vehicleDetail.tripReason")}</span>
        <span>{t("common.status")}</span>
        <span>{t("vehicleDetail.billing")}</span>
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
              className="grid grid-cols-[1.35fr_0.8fr_0.8fr_0.7fr_0.95fr_0.7fr_1.2fr] items-center gap-x-4 px-5 py-3"
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
                {t("vehicleDetail.feeCount", { count: trip.feeCount })}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatAmount(trip.outstandingFeeAmount)}
              </span>
              <span className="text-xs text-muted-foreground">
                {tripDuration(trip)}
              </span>
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {trip.paymentMode} · {trip.createdBy}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
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
