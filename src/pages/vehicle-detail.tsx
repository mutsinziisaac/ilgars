import { useMemo } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Plus,
  QrCode,
  RadioTower,
  Satellite,
  ShieldCheck,
  Truck,
  Wifi,
  WifiOff,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { StatusPill } from "@/components/fleet/status-pill"
import { VehicleIllustration } from "@/components/fleet/vehicle-illustration"
import {
  calculatePenalty,
  findVehicleByPlate,
  formatMzn,
  type Compliance,
  type DocumentRow,
  type RecentTrip,
  type TrackingDeviceStatus,
  type Vehicle,
} from "@/lib/fleet"
import { cn } from "@/lib/utils"

export default function VehicleDetail() {
  const { plate: rawPlate } = useParams<{ plate: string }>()
  const plate = rawPlate ? decodeURIComponent(rawPlate) : ""
  const vehicle = useMemo(() => findVehicleByPlate(plate), [plate])
  const navigate = useNavigate()

  if (!vehicle) {
    return (
      <Empty className="rounded-xl border border-border bg-card py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Truck className="size-5" />
          </EmptyMedia>
          <EmptyTitle>Vehicle not found</EmptyTitle>
          <EmptyDescription>
            We couldn't find a vehicle with plate "{plate}" in your fleet.
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
        <ActiveTripCard vehicle={vehicle} />
      </div>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList variant="line" className="border-b border-border pb-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trips">
            Trips
            <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {vehicle.recentTrips.length || 0}
            </span>
          </TabsTrigger>
          <TabsTrigger value="receipts">
            Charges & receipts
            <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              124
            </span>
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {vehicle.documents.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="device">
            Tracking device
            <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {vehicle.trackingDevice ? 1 : 0}
            </span>
          </TabsTrigger>
          <TabsTrigger value="activity">Activity log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-4">
              <RecentTripsCard trips={vehicle.recentTrips} />
            </div>
            <div className="flex flex-col gap-4">
              <TrackingDeviceCard vehicle={vehicle} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trips" className="mt-0">
          <PlaceholderCard
            title="All trips"
            description="The complete trip ledger for this vehicle will render here once the GPS trip feed lands."
          />
        </TabsContent>
        <TabsContent value="receipts" className="mt-0">
          <PlaceholderCard
            title="Charges & receipts"
            description="QR-verifiable receipts and per-charge breakdowns will appear here once the payment feed is wired."
          />
        </TabsContent>
        <TabsContent value="documents" className="mt-0">
          <DocumentsCard rows={vehicle.documents} expanded />
        </TabsContent>
        <TabsContent value="device" className="mt-0">
          <TrackingDeviceCard vehicle={vehicle} expanded />
        </TabsContent>
        <TabsContent value="activity" className="mt-0">
          <PlaceholderCard
            title="Activity log"
            description="State-change audit entries (BR-007-03) will surface here once the audit stream is connected."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card p-5",
        className
      )}
    >
      {children}
    </section>
  )
}

function VehicleHeroCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[200px_minmax(0,1fr)] md:items-center">
        <VehicleIllustration
          axles={vehicle.axles}
          size="lg"
          hatched
          className="h-32 w-full md:h-36"
        />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-2xl font-semibold tracking-wider text-foreground">
                {vehicle.plate}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {vehicle.model} · {vehicle.year} · {vehicle.configuration} · Chassis{" "}
                <span className="font-mono">{vehicle.chassisVin}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <ComplianceHeaderPill compliance={vehicle.compliance} />
              {vehicle.activeTrip && (
                <StatusPill tone="trip">
                  Active trip · {vehicle.activeTrip.id}
                </StatusPill>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-border bg-border md:grid-cols-4">
        <StatCell label="Axles" value={`${vehicle.axles}`} />
        <StatCell label="Gross weight" value={`${formatMzn(vehicle.weightKg)} kg`} />
        <StatCell label="Class" value={vehicle.rucClass} mono />
        <StatCell label="Odometer" value={`${formatMzn(vehicle.odometerKm)} km`} />
      </div>
    </section>
  )
}

function ComplianceHeaderPill({ compliance }: { compliance: Compliance }) {
  switch (compliance.kind) {
    case "compliant":
      return <StatusPill tone="compliant">Compliant</StatusPill>
    case "renewal-soon":
      return (
        <StatusPill tone="renewal-soon">
          Renewal in {compliance.daysLeft}d
        </StatusPill>
      )
    case "overdue":
      return (
        <StatusPill tone="critical">
          Overdue · {compliance.daysOverdue}d
        </StatusPill>
      )
    case "expired":
      return <StatusPill tone="critical">Expired</StatusPill>
    case "disputed":
      return <StatusPill tone="warning">Disputed</StatusPill>
  }
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

function ActiveTripCard({ vehicle }: { vehicle: Vehicle }) {
  if (vehicle.compliance.kind === "overdue") {
    return <OverstayCard vehicle={vehicle} compliance={vehicle.compliance} />
  }
  if (!vehicle.activeTrip) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          Active trip
        </p>
        <p className="text-sm text-muted-foreground">
          No active trip — vehicle is {vehicle.statusLabel.toLowerCase()}.
        </p>
        <Button variant="outline" size="sm" className="mt-auto w-fit rounded-md">
          <Plus />
          Start a trip
        </Button>
      </section>
    )
  }
  const { dayCurrent, dayTotal, startsAt, endsAt, licenceLabel } = vehicle.activeTrip
  const progress = dayTotal === 0 ? 0 : Math.min(100, (dayCurrent / dayTotal) * 100)
  return (
    <section className="relative overflow-hidden rounded-xl bg-sidebar p-5 text-sidebar-foreground">
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 h-12 w-24 rounded-tl-xl border-r-2 border-b-2 border-secondary"
      />
      <div className="flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-secondary" />
        <p className="text-[10px] font-semibold tracking-widest text-secondary uppercase">
          Active trip
        </p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">
        Day {dayCurrent} of {dayTotal}
      </p>
      <p className="mt-1 text-xs text-sidebar-foreground/70">{licenceLabel}</p>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-sidebar-accent/70">
        <div
          className="h-full rounded-full bg-secondary"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-sidebar-foreground/60">
        <span>{startsAt}</span>
        <span>{endsAt}</span>
      </div>

      <div className="mt-4 border-t border-sidebar-border/40 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-secondary uppercase">
              Driver
            </p>
            <p className="mt-0.5 text-sm font-semibold">{vehicle.driver?.name ?? "—"}</p>
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Show trip QR"
            className="rounded-md border-sidebar-border/40 bg-card text-sidebar hover:bg-card/80"
          >
            <QrCode className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}

function OverstayCard({
  vehicle,
  compliance,
}: {
  vehicle: Vehicle
  compliance: Extract<Compliance, { kind: "overdue" }>
}) {
  const penalty = calculatePenalty(vehicle)
  return (
    <section className="relative overflow-hidden rounded-xl border border-destructive/40 bg-destructive/5 p-5">
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 h-12 w-24 rounded-tl-xl border-r-2 border-b-2 border-destructive/50"
      />
      <div className="flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <AlertTriangle className="size-3" strokeWidth={2.5} />
        </span>
        <p className="text-[10px] font-semibold tracking-widest text-destructive uppercase">
          Overstayed in city
        </p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Day {compliance.daysOverdue}
        <span className="ml-1.5 align-baseline text-sm font-medium text-muted-foreground">
          past licence expiry
        </span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Last licence ended {compliance.expDate} · daily charges accrue under TX-08 rollover.
      </p>

      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-destructive/15"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-destructive"
          style={{ width: `${Math.min(100, compliance.daysOverdue * 5)}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Expired {compliance.expDate}</span>
        <span>Today</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-destructive/20 pt-4 text-sm">
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-destructive uppercase">
            Penalty so far
          </p>
          <p className="mt-0.5 font-semibold text-destructive tabular-nums">
            {formatMzn(penalty)}
            <span className="ml-1 text-[10px] font-medium text-destructive/70">MZN</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-destructive uppercase">
            Daily rate
          </p>
          <p className="mt-0.5 font-semibold text-foreground tabular-nums">
            {formatMzn(compliance.penaltyDailyMzn)}
            <span className="ml-1 text-[10px] font-medium text-muted-foreground">MZN/day</span>
          </p>
        </div>
      </div>

      <Button asChild size="sm" className="mt-4 w-full rounded-md">
        <Link
          to={`/pay-charges?vehicle=${encodeURIComponent(vehicle.plate)}&step=charge`}
        >
          Pay charges &amp; clear overstay
          <ArrowRight />
        </Link>
      </Button>
    </section>
  )
}

function RecentTripsCard({ trips }: { trips: RecentTrip[] }) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Recent trips</h3>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View all {trips.length}
          <ArrowUpRight className="size-3" />
        </button>
      </div>
      <div className="grid grid-cols-[1.1fr_1.4fr_1.4fr_1fr_auto] items-center gap-x-4 px-5 pb-2 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        <span>Trip</span>
        <span>Period</span>
        <span>Driver</span>
        <span>Charge</span>
        <span>Status</span>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {trips.length === 0 ? (
          <li className="px-5 py-6 text-center text-xs text-muted-foreground">
            No trips on record yet.
          </li>
        ) : (
          trips.map((t) => (
            <li
              key={t.id}
              className="grid grid-cols-[1.1fr_1.4fr_1.4fr_1fr_auto] items-center gap-x-4 px-5 py-3"
            >
              <span className="font-mono text-xs tracking-wider text-foreground">{t.id}</span>
              <span className="text-xs text-muted-foreground">
                {t.start} → {t.end}{" "}
                <span className="text-muted-foreground/70">({t.durationDays}d)</span>
              </span>
              <span className="text-xs text-foreground">{t.driver}</span>
              <span className="text-xs font-medium text-foreground tabular-nums">
                {formatMzn(t.charge)}
                <span className="ml-1 text-[10px] text-muted-foreground">MZN</span>
              </span>
              <StatusPill
                tone={t.status === "active" ? "trip" : t.status === "disputed" ? "critical" : "neutral"}
                withDot={t.status === "active"}
              >
                {t.status === "active"
                  ? "Active"
                  : t.status === "disputed"
                    ? "Disputed"
                    : "Closed"}
              </StatusPill>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

const DOC_ICON = {
  logbook: FileText,
  circulation: ShieldCheck,
  insurance: FileText,
  photos: ImageIcon,
} as const

const DOC_DOT_TONE = {
  ok: "bg-primary",
  warning: "bg-secondary",
  critical: "bg-destructive",
} as const

const DOC_TILE_TONE = {
  ok: "bg-chart-1/40 text-primary",
  warning: "bg-accent text-secondary",
  critical: "bg-destructive/10 text-destructive",
} as const

function DocumentsCard({
  rows,
  expanded = false,
}: {
  rows: DocumentRow[]
  expanded?: boolean
}) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Documents</h3>
        {!expanded && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Manage
            <ArrowUpRight className="size-3" />
          </button>
        )}
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {rows.map((row) => {
          const Icon = DOC_ICON[row.key]
          return (
            <li key={row.key} className="flex items-center gap-3 px-5 py-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md",
                  DOC_TILE_TONE[row.state]
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{row.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{row.subtitle}</p>
              </div>
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", DOC_DOT_TONE[row.state])}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function deviceStatusIcon(status: TrackingDeviceStatus) {
  if (status === "ACTIVE") return Wifi
  if (status === "OFFLINE" || status === "DECOMMISSIONED") return WifiOff
  return AlertTriangle
}

function formatLastSeen(iso: string): string {
  const seen = new Date(iso)
  const now = new Date(2026, 4, 4, 10, 30) // demo "now" anchored to the spec's reference moment
  const minutes = Math.max(0, Math.round((now.getTime() - seen.getTime()) / 60_000))
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return `${days} d ago`
}

function TrackingDeviceCard({
  vehicle,
  expanded = false,
}: {
  vehicle: Vehicle
  expanded?: boolean
}) {
  const device = vehicle.trackingDevice

  if (!device) {
    return (
      <section className="flex flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Tracking device
          </h3>
        </div>
        <div className="border-t border-border px-5 py-8 text-center">
          <Satellite className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-xs font-semibold text-foreground">
            No device installed
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            VL-06 requires an active GPS device for restricted-night and exceptional licences.
            Book an installation with a certified technician.
          </p>
        </div>
      </section>
    )
  }

  const StatusIcon = deviceStatusIcon(device.status)

  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <RadioTower className="size-3.5" />
        </span>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Tracking device
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-5 py-4 text-sm">
        <DeviceField label="Model" value={device.model} />
        <DeviceField label="Firmware" value={device.firmwareVersion} mono />
        <DeviceField label="Device ID" value={device.deviceId} mono />
        <DeviceField label="IMEI" value={device.imei} mono />
        <DeviceField
          label="Last ping"
          value={formatLastSeen(device.lastSeenAt)}
          trailing={<StatusIcon className="size-3.5 text-muted-foreground" />}
        />
        <DeviceField label="Protocol" value={device.protocol} />
      </div>

      {expanded && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-5 py-4 text-sm">
          <DeviceField label="Seal number" value={device.sealNumber} mono />
          <DeviceField label="Installed by" value={device.installedBy} />
          <DeviceField
            label="Installed at"
            value={new Date(device.installedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
          <DeviceField label="SIM ICCID" value={device.simIccid} mono />
          <DeviceField label="APN" value={device.apn} mono />
        </div>
      )}

      {device.status === "TAMPERED" && (
        <div className="flex items-start gap-2 border-t border-destructive/30 bg-destructive/5 px-5 py-3 text-[11px] leading-snug text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <p>
            <span className="font-semibold text-destructive">Tamper detected (DV-03).</span>{" "}
            Active trip's compliance is suspended until an inspection clears the seal.
          </p>
        </div>
      )}
      {device.status === "OFFLINE" && (
        <div className="flex items-start gap-2 border-t border-secondary/30 bg-accent/40 px-5 py-3 text-[11px] leading-snug text-muted-foreground">
          <WifiOff className="mt-0.5 size-3.5 shrink-0 text-secondary" />
          <p>
            Device hasn't reported in {formatLastSeen(device.lastSeenAt)}. Compliance auto-suspends
            past the configured grace window (VL-09).
          </p>
        </div>
      )}
    </section>
  )
}

function DeviceField({
  label,
  value,
  mono,
  trailing,
}: {
  label: string
  value: string
  mono?: boolean
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex items-center gap-1.5">
        <p
          className={cn(
            "truncate text-sm text-foreground",
            mono && "font-mono text-xs tracking-wider",
          )}
        >
          {value}
        </p>
        {trailing}
      </div>
    </div>
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
    <Card>
      <Empty className="bg-card py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CheckCircle2 className="size-5" />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </Card>
  )
}
