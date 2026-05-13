import { useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Truck,
} from "lucide-react"
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom"

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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { StatusPill } from "@/components/fleet/status-pill"
import { VehicleIllustration } from "@/components/fleet/vehicle-illustration"
import {
  getActiveFleetVehicles,
  type FleetVehicle,
} from "@/lib/fleet-vehicles-api"
import { capacityClassLabel } from "@/lib/fleet-vehicle-classification"
import { formatMzn } from "@/lib/fleet"
import {
  getTripsByVehicleId,
  type VehicleTrip,
} from "@/lib/trips-api"
import { cn } from "@/lib/utils"

const FLEET_VEHICLES_QUERY_KEY = ["fleet-vehicles", "ACTIVE"] as const

type LocationState = {
  vehicle?: FleetVehicle
}

function displayDate(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function statusLabel(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return "-"
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatCapacity(vehicle: FleetVehicle) {
  return `${formatMzn(Number(vehicle.capacitySnapshot))} ${vehicle.capacityUnit}`
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
  const { vehicleId: routeVehicleId, plate: legacyPlate } = useParams<{
    vehicleId?: string
    plate?: string
  }>()
  const vehicleId = decodeURIComponent(routeVehicleId ?? legacyPlate ?? "")
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const stateVehicle = (location.state as LocationState | null)?.vehicle
  const cachedVehicles =
    queryClient.getQueryData<FleetVehicle[]>(FLEET_VEHICLES_QUERY_KEY) ?? []

  const cachedVehicle = useMemo(
    () =>
      cachedVehicles.find(
        (vehicle) =>
          vehicle.vehicleId === vehicleId ||
          vehicle.plateNumberSnapshot === vehicleId
      ),
    [cachedVehicles, vehicleId]
  )

  const fleetQuery = useQuery({
    queryKey: FLEET_VEHICLES_QUERY_KEY,
    queryFn: getActiveFleetVehicles,
    enabled: !stateVehicle && !cachedVehicle,
  })

  const vehicle =
    stateVehicle ??
    cachedVehicle ??
    fleetQuery.data?.find(
      (item) =>
        item.vehicleId === vehicleId || item.plateNumberSnapshot === vehicleId
    )

  const tripsQuery = useQuery({
    queryKey: ["trips", vehicle?.vehicleId],
    queryFn: () => getTripsByVehicleId(vehicle!.vehicleId),
    enabled: !!vehicle?.vehicleId,
  })

  if (!vehicle && fleetQuery.isLoading) {
    return (
      <Empty className="rounded-xl border border-border bg-card py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
          <EmptyTitle>Loading vehicle</EmptyTitle>
          <EmptyDescription>
            Fetching the current fleet record for this vehicle.
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
          <EmptyTitle>Vehicle not found</EmptyTitle>
          <EmptyDescription>
            We couldn't find vehicle "{vehicleId}" in your active fleet.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => navigate("/fleet")} className="rounded-md">
            Back to fleet
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
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trips">
            Trips
            <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {tripsQuery.data?.length ?? 0}
            </span>
          </TabsTrigger>
          <TabsTrigger value="activity">Activity log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <VehicleFactsCard vehicle={vehicle} />
            <TripsCard
              trips={tripsQuery.data ?? []}
              isLoading={tripsQuery.isLoading}
              error={tripsQuery.error}
              onRetry={() => void tripsQuery.refetch()}
              compact
            />
          </div>
        </TabsContent>

        <TabsContent value="trips" className="mt-0">
          <TripsCard
            trips={tripsQuery.data ?? []}
            isLoading={tripsQuery.isLoading}
            error={tripsQuery.error}
            onRetry={() => void tripsQuery.refetch()}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-0">
          <PlaceholderCard
            title="Activity log"
            description="State-change audit entries will appear here when the audit stream is connected."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function VehicleHeroCard({ vehicle }: { vehicle: FleetVehicle }) {
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
                {vehicle.plateNumberSnapshot}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Truck <span className="font-mono">{vehicle.truckNumberSnapshot}</span> ·
                Vehicle ID <span className="font-mono">{vehicle.vehicleId}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill tone={vehicle.compliantForRating ? "compliant" : "warning"}>
                {vehicle.compliantForRating ? "Compliant" : "Not compliant"}
              </StatusPill>
              <StatusPill tone="neutral">{statusLabel(vehicle.status)}</StatusPill>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-border bg-border md:grid-cols-4">
        <StatCell label="Capacity" value={formatCapacity(vehicle)} />
        <StatCell label="Class" value={capacityClassLabel(vehicle)} />
        <StatCell label="Registry" value={statusLabel(vehicle.registryStatus)} />
        <StatCell label="Added" value={displayDate(vehicle.addedAt)} />
      </div>
    </section>
  )
}

function TripActionCard({ vehicle }: { vehicle: FleetVehicle }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        Road user charge
      </p>
      <p className="text-sm text-muted-foreground">
        Create a trip through the Pay Road User Charges workflow.
      </p>
      <Button asChild size="sm" className="mt-auto w-fit rounded-md">
        <Link
          to={`/pay-charges?vehicle=${encodeURIComponent(
            vehicle.plateNumberSnapshot
          )}&vehicleId=${encodeURIComponent(vehicle.vehicleId)}&step=charge`}
          state={{ fleetVehicle: vehicle }}
        >
          Create trip
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
      <p className={cn("mt-0.5 text-sm font-semibold text-foreground", mono && "font-mono")}>
        {value}
      </p>
    </div>
  )
}

function VehicleFactsCard({ vehicle }: { vehicle: FleetVehicle }) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Truck className="size-3.5" />
        </span>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Vehicle details
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 border-t border-border px-5 py-4 text-sm md:grid-cols-2">
        <DetailField label="Owner" value={vehicle.ownerNameSnapshot} />
        <DetailField label="Operator" value={vehicle.operatorNameSnapshot} />
        <DetailField label="Fleet ID" value={vehicle.fleetId} mono />
        <DetailField label="Fleet vehicle ID" value={vehicle.id} mono />
        <DetailField label="Snapshot at" value={displayDate(vehicle.vehicleSnapshotAt)} />
        <DetailField label="Updated" value={displayDate(vehicle.updatedAt)} />
        <DetailField label="Source" value={statusLabel(vehicle.source)} />
        <DetailField label="Added by" value={vehicle.addedBySubject} mono />
      </div>
    </section>
  )
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className={cn("truncate text-sm text-foreground", mono && "font-mono text-xs")}>
        {value || "-"}
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
  const visibleTrips = compact ? trips.slice(0, 5) : trips

  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Trips</h3>
        <span className="text-xs text-muted-foreground">
          {trips.length} total
        </span>
      </div>
      <div className="grid grid-cols-[1.35fr_0.8fr_0.8fr_0.7fr_0.95fr_0.7fr_1.2fr] items-center gap-x-4 border-t border-border px-5 py-2 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        <span>Trip</span>
        <span>Status</span>
        <span>Billing</span>
        <span>Fees</span>
        <span>Outstanding</span>
        <span>Duration</span>
        <span>Payment</span>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 border-t border-border px-5 py-8 text-sm text-muted-foreground">
          <Spinner />
          Loading trips...
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 border-t border-border px-5 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Could not load trips.</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Try again."}
          </p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      ) : visibleTrips.length === 0 ? (
        <div className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
          No trips on record yet.
        </div>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {visibleTrips.map((trip, index) => (
            <li
              key={`${trip.id}-${index}`}
              className="grid grid-cols-[1.35fr_0.8fr_0.8fr_0.7fr_0.95fr_0.7fr_1.2fr] items-center gap-x-4 px-5 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate font-mono text-xs tracking-wider text-foreground">
                  {trip.id}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {trip.reason}
                </span>
              </span>
              <span className="text-xs text-foreground">{statusLabel(trip.status)}</span>
              <span className="text-xs text-foreground">{statusLabel(trip.billingStatus)}</span>
              <span className="text-xs text-muted-foreground">
                {trip.feeCount} fee{trip.feeCount === 1 ? "" : "s"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatAmount(trip.outstandingFeeAmount)}
              </span>
              <span className="text-xs text-muted-foreground">{tripDuration(trip)}</span>
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
