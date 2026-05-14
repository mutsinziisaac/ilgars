import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  LayoutList,
  Map as MapIcon,
  Search,
  Truck,
} from "lucide-react"
import L from "leaflet"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"

import { formatDateValue } from "@/i18n/format"
import { StatusPill } from "@/components/fleet/status-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  getMyFleetVehicles,
  type MyFleetItem,
  type MyFleetTripContext,
} from "@/lib/fleet-vehicles-api"
import { capacityClassLabel } from "@/lib/fleet-vehicle-classification"
import { cn } from "@/lib/utils"

type FleetAction = "pay" | "topUp"

type FleetRow = {
  item: MyFleetItem
  id: string
  vehicleId: string
  plate: string
  truckNumber: string
  ownerOperator: string
  capacity: string
  classLabel: string
  tracker: string
  location: string
  tripLabel: string
  tripMeta: string
  tripTone: "compliant" | "trip" | "neutral" | "warning" | "critical"
  action: FleetAction
  needsSettlement: boolean
  latitude: number | null
  longitude: number | null
  observedAt: string | null
  searchText: string
}

const UGANDA_CENTER: [number, number] = [1.3733, 32.2903]
const UGANDA_BOUNDS: L.LatLngBoundsExpression = [
  [-1.6, 29.4],
  [4.4, 35.1],
]
const UGANDA_OVERVIEW_ZOOM = 7

function displayDate(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return formatDateValue(date, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function statusLabel(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return "-"
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function isActiveTrip(trip?: MyFleetTripContext | null) {
  const status = trip?.tripStatus?.toUpperCase()
  return trip?.onTrip === true || status === "OPEN" || status === "ACTIVE"
}

function hasPostpaidSettlement(trip?: MyFleetTripContext | null) {
  const paymentMode = trip?.paymentMode?.toUpperCase()
  const status = trip?.tripStatus?.toUpperCase()
  const billingStatus = trip?.billingStatus?.toUpperCase()
  const outstanding = Number(trip?.outstandingFeeAmount ?? 0)

  return (
    paymentMode === "POSTPAID" &&
    (outstanding > 0 ||
      status === "OPEN" ||
      status === "PENDING_SETTLEMENT" ||
      billingStatus === "PENDING_SETTLEMENT" ||
      billingStatus === "UNPAID")
  )
}

function formatCapacity(item: MyFleetItem) {
  const capacity = item.vehicle.capacity
  const unit = item.vehicle.capacityUnit ?? ""
  if (typeof capacity !== "number" || !Number.isFinite(capacity)) return "-"
  return `${capacity.toLocaleString()} ${unit}`.trim()
}

function validCoordinate(latitude: unknown, longitude: unknown) {
  if (typeof latitude !== "number" || typeof longitude !== "number") return false
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  if (latitude === 0 && longitude === 0) return false
  return latitude >= -1.6 && latitude <= 4.4 && longitude >= 29.4 && longitude <= 35.1
}

function fleetMarkerIcon(row: FleetRow) {
  return L.divIcon({
    className: "fleet-marker",
    html: `<span class="fleet-marker__truck${row.needsSettlement ? " fleet-marker__truck--alert" : ""}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 17h4V5H2v12h2" />
        <path d="M14 17h1" />
        <path d="M20 17h2v-5l-3-4h-5" />
        <path d="M2 13h12" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="18" cy="17" r="2" />
      </svg>
    </span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -10],
  })
}

function buildFleetRows(items: MyFleetItem[], t: ReturnType<typeof useTranslation>["t"]) {
  return items
    .map((item): FleetRow => {
      const vehicle = item.vehicle
      const trip = item.trip
      const active = isActiveTrip(trip)
      const needsSettlement = hasPostpaidSettlement(trip)
      const action: FleetAction = active && !needsSettlement ? "topUp" : "pay"
      const plate = vehicle.plateNumber || item.vehicleId || "-"
      const truckNumber = vehicle.truckNumber || "-"
      const ownerOperator = [vehicle.ownerName, vehicle.operatorName]
        .filter(Boolean)
        .join(" / ")
      const tracker = item.device?.trackerAssigned
        ? item.device.deviceUid ||
          item.device.serialNumber ||
          item.device.imei ||
          t("fleet.trackerAssigned")
        : t("fleet.noTracker")
      const latestLocation = item.location ?? item.device?.latestLocation
      const hasGps = validCoordinate(
        latestLocation?.latitude,
        latestLocation?.longitude
      )
      const location =
        latestLocation?.hasLocation === false
          ? t("fleet.noLocation")
          : latestLocation?.observedAt
            ? displayDate(latestLocation.observedAt)
            : t("fleet.noLocation")
      const tripLabel = needsSettlement
        ? t("fleet.settlementRequired")
        : active
          ? t("fleet.activeTrip")
          : trip?.tripStatus && trip.tripStatus !== "NO_ACTIVE_TRIP"
            ? statusLabel(trip.tripStatus)
            : t("fleet.noActiveTrip")
      const tripMeta = trip?.tripId
        ? `${trip.tripId} · ${statusLabel(trip.paymentMode)}`
        : statusLabel(trip?.paymentMode)
      const tripTone = needsSettlement
        ? "critical"
        : active
          ? "trip"
          : trip?.tripStatus && trip.tripStatus !== "NO_ACTIVE_TRIP"
            ? "neutral"
            : "compliant"
      const searchText = [
        item.id,
        item.vehicleId,
        item.status,
        plate,
        truckNumber,
        ownerOperator,
        tracker,
        trip?.tripId,
        trip?.tripStatus,
        trip?.paymentMode,
        trip?.billingStatus,
        item.device?.serialNumber,
        item.device?.imei,
      ]
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .toLowerCase()

      return {
        item,
        id: item.id,
        vehicleId: item.vehicleId || vehicle.vehicleId,
        plate,
        truckNumber,
        ownerOperator: ownerOperator || "-",
        capacity: formatCapacity(item),
        classLabel: capacityClassLabel({
          capacitySnapshot: vehicle.capacity ?? 0,
        } as Parameters<typeof capacityClassLabel>[0]),
        tracker,
        location,
        tripLabel,
        tripMeta,
        tripTone,
        action,
        needsSettlement,
        latitude: hasGps ? latestLocation!.latitude! : null,
        longitude: hasGps ? latestLocation!.longitude! : null,
        observedAt: latestLocation?.observedAt ?? null,
        searchText,
      }
    })
    .sort((a, b) => a.plate.localeCompare(b.plate))
}

export default function MyFleet() {
  const { t } = useTranslation()
  const [view, setView] = useState<"table" | "map">("table")
  const [query, setQuery] = useState("")
  const fleetQuery = useQuery({
    queryKey: ["myfleet", "ACTIVE"],
    queryFn: () => getMyFleetVehicles("ACTIVE"),
  })
  const rows = useMemo(
    () => buildFleetRows(fleetQuery.data ?? [], t),
    [fleetQuery.data, t]
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => row.searchText.includes(q))
  }, [query, rows])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="relative w-80 max-w-full">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("fleet.searchTrucks")}
            className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
          />
        </div>
        <Badge
          variant="secondary"
          className="bg-primary/10 px-2.5 py-1 text-xs text-primary"
        >
          {t("fleet.truckCount", { count: filtered.length })}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => {
              if (value === "table" || value === "map") setView(value)
            }}
            variant="outline"
            size="sm"
            className="rounded-lg"
          >
            <ToggleGroupItem value="table" aria-label={t("fleet.tableView")}>
              <LayoutList className="size-3.5" />
              <span className="ml-1.5">{t("fleet.table")}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="map" aria-label={t("fleet.mapView")}>
              <MapIcon className="size-3.5" />
              <span className="ml-1.5">{t("fleet.map")}</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {view === "table" ? (
        <FleetTable
          rows={filtered}
          query={query}
          isLoading={fleetQuery.isLoading}
          error={fleetQuery.error}
          onRetry={() => void fleetQuery.refetch()}
        />
      ) : (
        <FleetMap rows={filtered} />
      )}
    </div>
  )
}

function FleetTable({
  rows,
  query,
  isLoading,
  error,
  onRetry,
}: {
  rows: FleetRow[]
  query: string
  isLoading: boolean
  error: unknown
  onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {t("fleet.truck")}
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {t("common.owner")}
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {t("fleet.trackerLocation")}
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {t("fleet.tripPayment")}
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {t("common.class")}
            </TableHead>
            <TableHead className="pr-5 text-right text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {t("fleet.action")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  {t("common.loading")}
                </span>
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {t("fleet.loadFleetFailed")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {error instanceof Error ? error.message : t("landing.tryAgain")}
                  </p>
                  <Button size="sm" variant="outline" onClick={onRetry}>
                    {t("common.retry")}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                {query.trim() ? t("fleet.noTrucksSearch") : t("fleet.noTrucksYet")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => <FleetTableRow key={row.id} row={row} />)
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function FleetTableRow({ row }: { row: FleetRow }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const detailPath = `/portal/fleet/${encodeURIComponent(row.vehicleId)}`
  const actionPath = `/portal/pay-charges?vehicle=${encodeURIComponent(
    row.plate
  )}&vehicleId=${encodeURIComponent(row.vehicleId)}&step=circulation`

  return (
    <TableRow
      tabIndex={0}
      onClick={() => navigate(detailPath, { state: { fleetVehicle: row.item } })}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          navigate(detailPath, { state: { fleetVehicle: row.item } })
        }
      }}
      className="cursor-pointer border-border outline-none hover:bg-muted/40 focus-visible:bg-muted/40"
    >
      <TableCell className="pl-5">
        <div className="py-1">
          <p className="font-mono text-sm font-medium tracking-wide text-foreground">
            {row.plate}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {row.truckNumber}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <p className="max-w-[220px] truncate text-sm text-foreground">
          {row.ownerOperator}
        </p>
      </TableCell>
      <TableCell>
        <p className="max-w-[180px] truncate text-sm text-foreground">
          {row.tracker}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {row.location}
        </p>
      </TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          <StatusPill tone={row.tripTone}>
            {row.needsSettlement && <AlertTriangle className="size-3" />}
            {row.tripLabel}
          </StatusPill>
          <span
            className={cn(
              "max-w-[220px] truncate text-[11px] text-muted-foreground",
              row.needsSettlement && "font-medium text-destructive"
            )}
          >
            {row.tripMeta}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm text-foreground">{row.classLabel}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{row.capacity}</p>
      </TableCell>
      <TableCell className="pr-5 text-right">
        <Button
          size="sm"
          variant={row.needsSettlement ? "destructive" : "outline"}
          onClick={(event) => {
            event.stopPropagation()
            navigate(actionPath, { state: { fleetVehicle: row.item } })
          }}
          className="rounded-md"
        >
          {row.action === "topUp" ? t("fleet.topUp") : t("fleet.pay")}
          <ArrowRight className="size-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

function FitFleetBounds({ rows }: { rows: FleetRow[] }) {
  const map = useMap()

  useEffect(() => {
    const positions = rows
      .filter((row) => row.latitude !== null && row.longitude !== null)
      .map((row) => L.latLng(row.latitude!, row.longitude!))

    if (positions.length === 0) {
      map.setView(UGANDA_CENTER, UGANDA_OVERVIEW_ZOOM, { animate: false })
      return
    }

    if (positions.length === 1) {
      map.setView(positions[0], UGANDA_OVERVIEW_ZOOM, { animate: false })
      return
    }

    map.fitBounds(L.latLngBounds(positions), {
      padding: [36, 36],
      animate: false,
    })
  }, [map, rows])

  return null
}

function FleetTruckMarker({ row }: { row: FleetRow }) {
  const map = useMap()
  const { t } = useTranslation()

  return (
    <Marker
      position={[row.latitude!, row.longitude!]}
      icon={fleetMarkerIcon(row)}
      eventHandlers={{
        click: () => {
          map.setView([row.latitude!, row.longitude!], UGANDA_OVERVIEW_ZOOM, {
            animate: true,
          })
        },
      }}
    >
      <Popup>
        <div className="min-w-48 space-y-2">
          <div>
            <p className="font-mono text-sm font-semibold tracking-wide">
              {row.plate}
            </p>
            <p className="text-xs text-muted-foreground">{row.truckNumber}</p>
          </div>
          <div className="grid gap-1 text-xs">
            <p>
              <span className="font-medium">{t("fleet.tracker")}:</span>{" "}
              {row.tracker}
            </p>
            <p>
              <span className="font-medium">{t("fleet.tripPayment")}:</span>{" "}
              {row.tripLabel}
            </p>
            <p>
              <span className="font-medium">{t("fleet.lastSeen")}:</span>{" "}
              {row.observedAt ? displayDate(row.observedAt) : t("fleet.noLocation")}
            </p>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

function FleetMap({ rows }: { rows: FleetRow[] }) {
  const { t } = useTranslation()
  const mappedRows = rows.filter(
    (row) => row.latitude !== null && row.longitude !== null
  )

  return (
    <div className="relative h-[760px] overflow-hidden rounded-xl border border-border bg-muted/40">
      <MapContainer
        center={UGANDA_CENTER}
        zoom={7}
        minZoom={7}
        maxBounds={UGANDA_BOUNDS}
        maxBoundsViscosity={1}
        zoomControl
        scrollWheelZoom
        attributionControl={false}
        className="fleet-map h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains={["a", "b", "c"]}
          maxZoom={19}
          crossOrigin
        />
        {mappedRows.map((row) => (
          <FleetTruckMarker key={row.id} row={row} />
        ))}
        <FitFleetBounds rows={mappedRows} />
      </MapContainer>

      {mappedRows.length === 0 && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-card/80 px-6 backdrop-blur-[1px]">
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-card text-primary shadow-sm">
              <Truck className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t("fleet.noGpsTrucks")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("fleet.noGpsTrucksDescription")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
