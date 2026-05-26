import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Clock,
  LayoutList,
  Map as MapIcon,
  MapPin,
  Radio,
  Receipt,
  Search,
  Truck,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import {
  InfoWindow,
  Map,
  Marker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps"

import fleetTruckGreen from "@/assets/fleet-truck-green.png"
import fleetTruckGrey from "@/assets/fleet-truck-grey.png"
import fleetTruckRed from "@/assets/fleet-truck-red.png"
import { formatCurrencyMzn, formatDateValue } from "@/i18n/format"
import { GoogleMapsBoundary } from "@/components/maps/google-maps-boundary"
import { StatusPill } from "@/components/fleet/status-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  type MyFleetViolation,
} from "@/lib/fleet-vehicles-api"
import {
  formatViolationAmount,
  isOpenViolation,
  sumOpenAmountMzn,
  violationCodeLabel,
  violationStatusLabel,
  violationStatusTone,
  violationToneForList,
  type ViolationTone,
} from "@/lib/violations"
import { capacityClassLabel } from "@/lib/fleet-vehicle-classification"
import {
  getMapStyles,
  UGANDA_CENTER,
  UGANDA_OVERVIEW_ZOOM,
  useResolvedTheme,
} from "@/lib/google-maps"
import { useReverseGeocode } from "@/lib/reverse-geocode"
import { cn } from "@/lib/utils"

const TRUCK_ICON_BY_TONE: Record<FleetRow["tripTone"], string> = {
  trip: fleetTruckGreen,
  compliant: fleetTruckGreen,
  neutral: fleetTruckGrey,
  warning: fleetTruckRed,
  critical: fleetTruckRed,
}

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
  tripLabel: string
  tripMeta: string
  tripTone: "compliant" | "trip" | "neutral" | "warning" | "critical"
  action: FleetAction
  needsSettlement: boolean
  latitude: number | null
  longitude: number | null
  observedAt: string | null
  lastSeenAt: string | null
  violations: MyFleetViolation[]
  openViolations: MyFleetViolation[]
  violationCount: number
  violationTone: ViolationTone
  violationAmountLabel: string | null
  searchText: string
}

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
  if (typeof capacity !== "number" || !Number.isFinite(capacity)) return "-"
  return `${capacity.toLocaleString()} kg`
}

function validCoordinate(latitude: unknown, longitude: unknown) {
  if (typeof latitude !== "number" || typeof longitude !== "number") return false
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  if (latitude === 0 && longitude === 0) return false
  return latitude >= -1.6 && latitude <= 4.4 && longitude >= 29.4 && longitude <= 35.1
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
      const violations = Array.isArray(item.violations) ? item.violations : []
      const openViolations = violations.filter(isOpenViolation)
      const violationTone = violationToneForList(openViolations)
      const openMznTotal = sumOpenAmountMzn(openViolations)
      const violationAmountLabel =
        openMznTotal > 0 ? `${formatCurrencyMzn(openMznTotal)} MZN` : null
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
        ...violations.flatMap((v) => [v.code, v.reason, v.status, v.tripId]),
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
        tripLabel,
        tripMeta,
        tripTone,
        action,
        needsSettlement,
        latitude: hasGps ? latestLocation!.latitude! : null,
        longitude: hasGps ? latestLocation!.longitude! : null,
        observedAt: latestLocation?.observedAt ?? null,
        lastSeenAt: item.device?.health?.lastSeenAt ?? null,
        violations,
        openViolations,
        violationCount: openViolations.length,
        violationTone,
        violationAmountLabel,
        searchText,
      }
    })
    .sort((a, b) => a.plate.localeCompare(b.plate))
}

type TripStatusFilter = "all" | "active" | "settlement" | "idle"

const TRIP_STATUS_FILTERS: { value: TripStatusFilter; labelKey: string }[] = [
  { value: "all", labelKey: "fleet.statusFilter.all" },
  { value: "active", labelKey: "fleet.activeTrip" },
  { value: "settlement", labelKey: "fleet.settlementRequired" },
  { value: "idle", labelKey: "fleet.noActiveTrip" },
]

function tripStatusKey(row: FleetRow): TripStatusFilter {
  if (row.tripTone === "trip") return "active"
  if (row.tripTone === "critical") return "settlement"
  return "idle"
}

export default function MyFleet() {
  const { t } = useTranslation()
  const [view, setView] = useState<"table" | "map">("table")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<TripStatusFilter>("all")
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
    return rows.filter((row) => {
      if (statusFilter !== "all" && tripStatusKey(row) !== statusFilter) {
        return false
      }
      if (q && !row.searchText.includes(q)) return false
      return true
    })
  }, [query, rows, statusFilter])

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
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as TripStatusFilter)}
        >
          <SelectTrigger
            className="h-9 w-44 rounded-lg border-border bg-background text-sm shadow-none"
            aria-label={t("fleet.statusFilter.label")}
          >
            <SelectValue placeholder={t("fleet.statusFilter.label")} />
          </SelectTrigger>
          <SelectContent>
            {TRIP_STATUS_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          filtersActive={query.trim() !== "" || statusFilter !== "all"}
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
  filtersActive,
  isLoading,
  error,
  onRetry,
}: {
  rows: FleetRow[]
  filtersActive: boolean
  isLoading: boolean
  error: unknown
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const [openRowId, setOpenRowId] = useState<string | null>(null)
  const activeRow = openRowId ? rows.find((r) => r.id === openRowId) ?? null : null

  return (
    <>
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
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                {t("fleet.violations")}
              </TableHead>
              <TableHead className="pr-5 text-center text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                {t("fleet.action")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    {t("common.loading")}
                  </span>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
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
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  {filtersActive ? t("fleet.noTrucksSearch") : t("fleet.noTrucksYet")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <FleetTableRow
                  key={row.id}
                  row={row}
                  onShowViolations={() => setOpenRowId(row.id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <ViolationsDialog
        row={activeRow}
        open={activeRow !== null}
        onOpenChange={(next) => {
          if (!next) setOpenRowId(null)
        }}
      />
    </>
  )
}

function LocationCell({
  latitude,
  longitude,
}: {
  latitude: number | null
  longitude: number | null
}) {
  const { place } = useReverseGeocode(latitude, longitude, latitude != null)
  return (
    <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-muted-foreground">
      {place ?? "-"}
    </p>
  )
}

function FleetTableRow({
  row,
  onShowViolations,
}: {
  row: FleetRow
  onShowViolations: () => void
}) {
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
        <LocationCell
          latitude={row.latitude}
          longitude={row.longitude}
        />
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
      <TableCell>
        {row.violationCount === 0 ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onShowViolations()
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation()
              }
            }}
            className="flex flex-col items-start gap-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StatusPill tone={row.violationTone}>
              <AlertTriangle className="size-3" />
              {t("fleet.violationCount", { count: row.violationCount })}
            </StatusPill>
            {row.violationAmountLabel && (
              <span className="text-[11px] font-medium text-destructive">
                {row.violationAmountLabel}
              </span>
            )}
          </button>
        )}
      </TableCell>
      <TableCell className="pr-5 text-center">
        <Button
          size="sm"
          variant={row.needsSettlement ? "destructive" : "outline"}
          onClick={(event) => {
            event.stopPropagation()
            navigate(actionPath, { state: { fleetVehicle: row.item } })
          }}
          className="mx-auto rounded-md"
        >
          {row.action === "topUp" ? t("fleet.topUp") : t("fleet.pay")}
          <ArrowRight className="size-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

function ViolationsDialog({
  row,
  open,
  onOpenChange,
}: {
  row: FleetRow | null
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const { t } = useTranslation()
  const violations = row?.violations ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("fleet.violationDetailsTitle", { plate: row?.plate ?? "" })}
          </DialogTitle>
          <DialogDescription>
            {violations.length === 0
              ? t("fleet.noViolations")
              : t("fleet.violationCount", { count: violations.length })}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {violations.map((violation) => {
            const amount = formatViolationAmount(violation)
            const tone = violationStatusTone(violation.status)
            const assignment = violation.assignment ?? null
            const truckLoc = violation.truckLocation ?? null
            return (
              <div
                key={violation.id}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {violationCodeLabel(violation.code ?? violation.reason, t)}
                  </p>
                  <StatusPill tone={tone}>
                    {violationStatusLabel(violation.status, t)}
                  </StatusPill>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-2">
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
                  {violation.tripId && (
                    <div className="sm:col-span-2">
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("fleet.violationTrip")}
                      </dt>
                      <dd className="break-all font-mono text-[11px] text-foreground">
                        {violation.tripId}
                      </dd>
                    </div>
                  )}
                  {violation.createdAt && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("fleet.violationCreatedAt")}
                      </dt>
                      <dd className="text-foreground">{displayDate(violation.createdAt)}</dd>
                    </div>
                  )}
                  {violation.updatedAt && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("fleet.violationUpdatedAt")}
                      </dt>
                      <dd className="text-foreground">{displayDate(violation.updatedAt)}</dd>
                    </div>
                  )}
                  {truckLoc?.hasLocation &&
                    typeof truckLoc.latitude === "number" &&
                    typeof truckLoc.longitude === "number" && (
                      <div className="sm:col-span-2">
                        <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t("fleet.violationLocation")}
                        </dt>
                        <dd className="font-mono text-[11px] text-foreground">
                          {truckLoc.latitude.toFixed(5)}, {truckLoc.longitude.toFixed(5)}
                          {truckLoc.observedAt && (
                            <span className="ml-2 text-muted-foreground">
                              · {displayDate(truckLoc.observedAt)}
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
                      <dd className="text-foreground">{displayDate(assignment.resolvedAt)}</dd>
                    </div>
                  )}
                  {assignment?.releasedAt && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("fleet.violationReleasedAt")}
                      </dt>
                      <dd className="text-foreground">{displayDate(assignment.releasedAt)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FitFleetBounds({ rows }: { rows: FleetRow[] }) {
  const map = useMap()
  const coreLib = useMapsLibrary("core")

  useEffect(() => {
    if (!map || !coreLib) return

    const positions = rows
      .filter((row) => row.latitude !== null && row.longitude !== null)
      .map((row) => ({ lat: row.latitude!, lng: row.longitude! }))

    if (positions.length === 0) {
      map.setCenter(UGANDA_CENTER)
      map.setZoom(UGANDA_OVERVIEW_ZOOM)
      return
    }

    if (positions.length === 1) {
      map.setCenter(positions[0])
      map.setZoom(UGANDA_OVERVIEW_ZOOM)
      return
    }

    const bounds = new coreLib.LatLngBounds()
    positions.forEach((position) => bounds.extend(position))
    map.fitBounds(bounds, 36)
  }, [map, coreLib, rows])

  return null
}

function FleetTruckMarker({
  row,
  isOpen,
  onToggle,
}: {
  row: FleetRow
  isOpen: boolean
  onToggle: (id: string | null) => void
}) {
  const map = useMap()
  const markerLib = useMapsLibrary("marker")
  const navigate = useNavigate()
  const { t } = useTranslation()
  const position = { lat: row.latitude!, lng: row.longitude! }
  const { place: geocodedPlace } = useReverseGeocode(
    row.latitude,
    row.longitude,
    isOpen
  )
  const lastSeenValue = row.lastSeenAt ?? row.observedAt
  const icon = markerLib
    ? {
        url: TRUCK_ICON_BY_TONE[row.tripTone],
        scaledSize: new google.maps.Size(56, 42),
        anchor: new google.maps.Point(28, 32),
      }
    : undefined

  return (
    <>
      <Marker
        position={position}
        icon={icon}
        onClick={() => {
          map?.panTo(position)
          map?.setZoom(UGANDA_OVERVIEW_ZOOM)
          onToggle(row.id)
        }}
      />
      {isOpen && (
        <InfoWindow position={position} onCloseClick={() => onToggle(null)}>
          <div className="w-64 space-y-3 p-0.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-base font-semibold tracking-wide text-foreground">
                  {row.plate}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {row.truckNumber}
                </p>
              </div>
              <StatusPill tone={row.tripTone} className="shrink-0">
                {row.tripLabel}
              </StatusPill>
            </div>

            <ul className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5">
              <InfoRow
                icon={Radio}
                label={t("fleet.tracker")}
                value={row.tracker}
              />
              <InfoRow
                icon={Receipt}
                label={t("fleet.tripPayment")}
                value={row.tripLabel}
                tone={row.needsSettlement ? "critical" : undefined}
              />
              <InfoRow
                icon={MapPin}
                label={t("fleet.location")}
                value={geocodedPlace ?? "-"}
              />
              <InfoRow
                icon={Clock}
                label={t("fleet.lastSeen")}
                value={lastSeenValue ? displayDate(lastSeenValue) : "-"}
              />
            </ul>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                navigate(`/portal/fleet/${encodeURIComponent(row.vehicleId)}`)
              }
              className="h-8 w-full justify-between gap-2 text-xs"
            >
              {t("common.viewDetails")}
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </InfoWindow>
      )}
    </>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Radio
  label: string
  value: string
  tone?: "critical"
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-xs font-medium",
            tone === "critical" ? "text-destructive" : "text-foreground"
          )}
        >
          {value}
        </p>
      </div>
    </li>
  )
}

const HIDE_NATIVE_POI_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
]

function FleetMap({ rows }: { rows: FleetRow[] }) {
  const { t } = useTranslation()
  const theme = useResolvedTheme()
  const [openId, setOpenId] = useState<string | null>(null)
  const mappedRows = rows.filter(
    (row) => row.latitude !== null && row.longitude !== null
  )
  const mapStyles = useMemo(
    () => [...getMapStyles(theme), ...HIDE_NATIVE_POI_STYLES],
    [theme]
  )

  return (
    <div className="relative h-[calc(100vh-12rem)] min-h-[420px] overflow-hidden rounded-xl border border-border bg-muted/40">
      <GoogleMapsBoundary>
        <Map
          key={theme}
          defaultCenter={UGANDA_CENTER}
          defaultZoom={UGANDA_OVERVIEW_ZOOM}
          styles={mapStyles}
          gestureHandling="greedy"
          disableDefaultUI={false}
          zoomControl
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          clickableIcons={false}
          className="h-full w-full"
        >
          {mappedRows.map((row) => (
            <FleetTruckMarker
              key={row.id}
              row={row}
              isOpen={openId === row.id}
              onToggle={(id) => setOpenId(id)}
            />
          ))}
          <FitFleetBounds rows={mappedRows} />
        </Map>
      </GoogleMapsBoundary>

      {mappedRows.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center bg-card/80 px-6 backdrop-blur-[1px]">
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
