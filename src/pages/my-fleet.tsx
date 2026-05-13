import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  LayoutList,
  Map as MapIcon,
  MapPin,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  getActiveFleetVehicles,
  type FleetVehicle,
} from "@/lib/fleet-vehicles-api"
import { capacityClassLabel } from "@/lib/fleet-vehicle-classification"
import { formatMzn } from "@/lib/fleet"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | "ACTIVE"

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All active vehicles" },
  { value: "ACTIVE", label: "Active" },
]

const FLEET_VEHICLES_QUERY_KEY = ["fleet-vehicles", "ACTIVE"] as const

function statusLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatCapacity(vehicle: FleetVehicle) {
  return `${formatMzn(Number(vehicle.capacitySnapshot))} ${vehicle.capacityUnit}`
}

function includesQuery(vehicle: FleetVehicle, query: string) {
  const haystack = [
    vehicle.plateNumberSnapshot,
    vehicle.truckNumberSnapshot,
    vehicle.ownerNameSnapshot,
    vehicle.operatorNameSnapshot,
    vehicle.vehicleId,
    capacityClassLabel(vehicle),
    vehicle.registryStatus,
    vehicle.exemptionStatus,
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(query)
}

export default function MyFleet() {
  const [view, setView] = useState<"table" | "map">("table")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [query, setQuery] = useState("")
  const fleetQuery = useQuery({
    queryKey: FLEET_VEHICLES_QUERY_KEY,
    queryFn: getActiveFleetVehicles,
  })
  const vehicles = fleetQuery.data ?? []

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: vehicles.length,
      ACTIVE: 0,
    }

    for (const vehicle of vehicles) {
      if (vehicle.status === "ACTIVE") c.ACTIVE += 1
    }

    return c
  }, [vehicles])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return vehicles.filter((vehicle) => {
      if (status !== "all" && vehicle.status !== status) return false
      if (!q) return true
      return includesQuery(vehicle, q)
    })
  }, [query, status, vehicles])

  return (
    <div className="space-y-4">
      <FilterBar
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        view={view}
        onViewChange={setView}
        counts={counts}
      />

      {view === "table" ? (
        <FleetTable
          vehicles={filtered}
          query={query}
          isLoading={fleetQuery.isLoading}
          error={fleetQuery.error}
          onRetry={() => void fleetQuery.refetch()}
        />
      ) : (
        <FleetMapPlaceholder count={filtered.length} />
      )}
    </div>
  )
}

function FilterBar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  view,
  onViewChange,
  counts,
}: {
  query: string
  onQueryChange: (v: string) => void
  status: StatusFilter
  onStatusChange: (v: StatusFilter) => void
  view: "table" | "map"
  onViewChange: (v: "table" | "map") => void
  counts: Record<StatusFilter, number>
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className="relative w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search plate, truck, owner…"
          className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
        />
      </div>

      <Select
        value={status}
        onValueChange={(v) => onStatusChange(v as StatusFilter)}
      >
        <SelectTrigger className="h-9 w-48 rounded-lg">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <span className="flex w-full items-center justify-between gap-3">
                <span>{opt.label}</span>
                <span className="text-xs text-muted-foreground">
                  {counts[opt.value]}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => {
            if (v === "table" || v === "map") onViewChange(v)
          }}
          variant="outline"
          size="sm"
          className="rounded-lg"
        >
          <ToggleGroupItem value="table" aria-label="Table view">
            <LayoutList className="size-3.5" />
            <span className="ml-1.5">Table</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="map" aria-label="Map view">
            <MapIcon className="size-3.5" />
            <span className="ml-1.5">Map</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}

function FleetTable({
  vehicles,
  query,
  isLoading,
  error,
  onRetry,
}: {
  vehicles: FleetVehicle[]
  query: string
  isLoading: boolean
  error: unknown
  onRetry: () => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Vehicle
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Owner / Operator
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Capacity
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Class
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Registry
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Rating
            </TableHead>
            <TableHead className="pr-5 text-right text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <LoadingRow />
          ) : error ? (
            <ErrorRow error={error} onRetry={onRetry} />
          ) : vehicles.length === 0 ? (
            <EmptyRow query={query} />
          ) : (
            vehicles.map((vehicle) => (
              <FleetVehicleRow key={vehicle.id} vehicle={vehicle} />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function FleetVehicleRow({ vehicle }: { vehicle: FleetVehicle }) {
  const navigate = useNavigate()
  const openDetail = () => {
    navigate(`/fleet/${encodeURIComponent(vehicle.vehicleId)}`, {
      state: { vehicle },
    })
  }
  const createTrip = () => {
    navigate(
      `/pay-charges?vehicle=${encodeURIComponent(
        vehicle.plateNumberSnapshot
      )}&vehicleId=${encodeURIComponent(vehicle.vehicleId)}&step=charge`,
      { state: { fleetVehicle: vehicle } }
    )
  }

  return (
    <TableRow
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          openDetail()
        }
      }}
      className="cursor-pointer border-border outline-none hover:bg-muted/40 focus-visible:bg-muted/40"
    >
      <TableCell className="pl-5">
        <div className="py-1">
          <p className="font-mono text-sm font-medium tracking-wide text-foreground hover:underline">
            {vehicle.plateNumberSnapshot}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {vehicle.truckNumberSnapshot}
          </p>
          <p className="mt-0.5 max-w-48 truncate font-mono text-[10px] text-muted-foreground/80">
            {vehicle.vehicleId}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm text-foreground">{vehicle.ownerNameSnapshot}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {vehicle.operatorNameSnapshot}
        </p>
      </TableCell>
      <TableCell>
        <p className="text-sm text-foreground">{formatCapacity(vehicle)}</p>
      </TableCell>
      <TableCell>
        <p className="text-sm text-foreground">{capacityClassLabel(vehicle)}</p>
      </TableCell>
      <TableCell>
        <StatusBadge value={vehicle.registryStatus} />
      </TableCell>
      <TableCell>
        <ComplianceBadge compliant={vehicle.compliantForRating} />
      </TableCell>
      <TableCell className="pr-5 text-right">
        <Button
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            createTrip()
          }}
          className="rounded-md"
        >
          <Plus className="size-3.5" />
          Create trip
        </Button>
      </TableCell>
    </TableRow>
  )
}

function LoadingRow() {
  return (
    <TableRow>
      <TableCell
        colSpan={7}
        className="py-12 text-center text-sm text-muted-foreground"
      >
        <span className="inline-flex items-center gap-2">
          <Spinner />
          Loading active fleet vehicles…
        </span>
      </TableCell>
    </TableRow>
  )
}

function EmptyRow({ query }: { query: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={7}
        className="py-12 text-center text-sm text-muted-foreground"
      >
        {query.trim()
          ? "No active vehicles match this search."
          : "No active vehicles found."}
      </TableCell>
    </TableRow>
  )
}

function ErrorRow({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <TableRow>
      <TableCell colSpan={7} className="py-12 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
          <p className="text-sm font-medium text-foreground">
            Could not load fleet vehicles.
          </p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Try again."}
          </p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function StatusBadge({ value }: { value: string }) {
  return (
    <Badge
      variant="secondary"
      className="bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
    >
      {statusLabel(value)}
    </Badge>
  )
}

function ComplianceBadge({ compliant }: { compliant: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "px-2 py-0.5 text-[11px]",
        compliant
          ? "bg-chart-1/60 text-primary"
          : "bg-destructive/10 text-destructive"
      )}
    >
      {compliant ? "Compliant" : "Not compliant"}
    </Badge>
  )
}

function FleetMapPlaceholder({ count }: { count: number }) {
  return (
    <div className="flex h-[420px] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-card text-primary">
          <MapPin className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Map view</p>
          <p className="text-xs text-muted-foreground">
            Vehicle locations will render here once the GIS integration ships.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="bg-card px-2 py-0.5 text-[11px] text-foreground"
        >
          {count} vehicle{count === 1 ? "" : "s"}
        </Badge>
      </div>
    </div>
  )
}
