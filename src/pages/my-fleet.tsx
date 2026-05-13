import { useMemo, useState } from "react"
import {
  CalendarDays,
  LayoutList,
  Map as MapIcon,
  Plus,
  Search,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { FLEET, formatMzn, type RecentTrip, type Vehicle } from "@/lib/fleet"
import { cn } from "@/lib/utils"

type TripRow = RecentTrip & {
  vehicle: Vehicle
}

function buildTripRows(): TripRow[] {
  return FLEET.flatMap((vehicle) =>
    vehicle.recentTrips.map((trip) => ({ ...trip, vehicle }))
  ).sort((a, b) => a.id.localeCompare(b.id) * -1)
}

function tripMatches(row: TripRow, query: string) {
  return [
    row.id,
    row.vehicle.plate,
    row.vehicle.model,
    row.driver,
    row.status,
    row.vehicle.ref,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query)
}

export default function MyFleet() {
  const navigate = useNavigate()
  const [view, setView] = useState<"table" | "map">("table")
  const [query, setQuery] = useState("")
  const trips = useMemo(() => buildTripRows(), [])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return trips
    return trips.filter((row) => tripMatches(row, q))
  }, [query, trips])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="relative w-80 max-w-full">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search trips, plates, drivers..."
            className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
          />
        </div>
        <Badge
          variant="secondary"
          className="bg-primary/10 px-2.5 py-1 text-xs text-primary"
        >
          {filtered.length} trip{filtered.length === 1 ? "" : "s"}
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
            <ToggleGroupItem value="table" aria-label="Table view">
              <LayoutList className="size-3.5" />
              <span className="ml-1.5">Table</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="map" aria-label="Map view">
              <MapIcon className="size-3.5" />
              <span className="ml-1.5">Map</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <Button
            size="sm"
            onClick={() => navigate("/portal/pay-charges?step=vehicle")}
            className="rounded-lg"
          >
            <Plus className="size-3.5" />
            New trip
          </Button>
        </div>
      </div>

      {view === "table" ? (
        <TripsTable rows={filtered} query={query} />
      ) : (
        <TripsMapPlaceholder count={filtered.length} />
      )}
    </div>
  )
}

function TripsTable({ rows, query }: { rows: TripRow[]; query: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Trip
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Vehicle
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Dates
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Driver
            </TableHead>
            <TableHead className="text-right text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Charge
            </TableHead>
            <TableHead className="pr-5 text-right text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-12 text-center text-sm text-muted-foreground"
              >
                {query.trim()
                  ? "No trips match this search."
                  : "No trips found yet. Create a trip to start the circulation flow."}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => <TripTableRow key={row.id} row={row} />)
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function TripTableRow({ row }: { row: TripRow }) {
  const navigate = useNavigate()
  return (
    <TableRow
      tabIndex={0}
      onClick={() => navigate("/portal/pay-charges?step=vehicle")}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          navigate("/portal/pay-charges?step=vehicle")
        }
      }}
      className="cursor-pointer border-border outline-none hover:bg-muted/40 focus-visible:bg-muted/40"
    >
      <TableCell className="pl-5">
        <div className="py-1">
          <p className="font-mono text-sm font-medium tracking-wide text-foreground">
            {row.id}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {row.durationDays} day{row.durationDays === 1 ? "" : "s"}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <p className="font-mono text-sm text-foreground">{row.vehicle.plate}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {row.vehicle.model}
        </p>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
          <CalendarDays className="size-3.5 text-muted-foreground" />
          {row.start} - {row.end}
        </span>
      </TableCell>
      <TableCell>
        <p className="text-sm text-foreground">{row.driver}</p>
      </TableCell>
      <TableCell className="text-right text-sm text-foreground tabular-nums">
        {formatMzn(row.charge)} MZN
      </TableCell>
      <TableCell className="pr-5 text-right">
        <TripStatusBadge status={row.status} />
      </TableCell>
    </TableRow>
  )
}

function TripStatusBadge({ status }: { status: RecentTrip["status"] }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "px-2 py-0.5 text-[11px]",
        status === "active" && "bg-primary/10 text-primary",
        status === "closed" && "bg-muted text-muted-foreground",
        status === "disputed" && "bg-destructive/10 text-destructive"
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

function TripsMapPlaceholder({ count }: { count: number }) {
  return (
    <div className="flex h-[420px] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-card text-primary">
          <MapIcon className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Trip map</p>
          <p className="text-xs text-muted-foreground">
            Trip routes and route points will render here once GIS is connected.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="bg-card px-2 py-0.5 text-[11px] text-foreground"
        >
          {count} trip{count === 1 ? "" : "s"}
        </Badge>
      </div>
    </div>
  )
}
