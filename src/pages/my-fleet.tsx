import { useMemo, useState } from "react"
import {
  CreditCard,
  LayoutList,
  Map as MapIcon,
  MapPin,
  Play,
  Plus,
  Search,
} from "lucide-react"
import { Link, NavLink } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { VehicleIllustration } from "@/components/fleet/vehicle-illustration"
import {
  FLEET,
  calculatePenalty,
  formatMzn,
  type Compliance,
  type Status,
  type Vehicle,
} from "@/lib/fleet"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | Status

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All status" },
  { value: "active", label: "Active" },
  { value: "idle", label: "Idle" },
  { value: "maintenance", label: "Maintenance" },
  { value: "out-of-service", label: "Out of service" },
]

function plateHref(plate: string) {
  return `/fleet/${encodeURIComponent(plate)}`
}

export default function MyFleet() {
  const [view, setView] = useState<"table" | "map">("table")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [query, setQuery] = useState("")

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: FLEET.length,
      active: 0,
      idle: 0,
      maintenance: 0,
      "out-of-service": 0,
    }
    for (const v of FLEET) c[v.status] += 1
    return c
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FLEET.filter((v) => {
      if (status !== "all" && v.status !== status) return false
      if (!q) return true
      return (
        v.plate.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        (v.driver?.name.toLowerCase().includes(q) ?? false)
      )
    })
  }, [status, query])

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
        <FleetTable vehicles={filtered} />
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
          placeholder="Search plate, driver, ref…"
          className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
        />
      </div>

      <Select
        value={status}
        onValueChange={(v) => onStatusChange(v as StatusFilter)}
      >
        <SelectTrigger className="h-9 w-44 rounded-lg">
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

function FleetTable({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Vehicle
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Capacity
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Color
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Status
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Compliance
            </TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Overdue amount
            </TableHead>
            <TableHead className="pr-5 text-right text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-12 text-center text-sm text-muted-foreground"
              >
                No vehicles match this filter.
              </TableCell>
            </TableRow>
          ) : (
            vehicles.map((v) => (
              <TableRow key={v.plate} className="border-border">
                <TableCell className="pl-5">
                  <Link
                    to={plateHref(v.plate)}
                    className="flex items-center gap-3 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <VehicleIllustration axles={v.axles} />
                    <div className="leading-tight">
                      <p className="text-sm font-medium tracking-wide text-foreground hover:underline">
                        {v.plate}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {v.model} · {v.year}
                      </p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-foreground">
                    {formatMzn(v.weightKg)} kg
                  </p>
                </TableCell>
                <TableCell>
                  <ColorCell color={v.color} />
                </TableCell>
                <TableCell>
                  <StatusCell status={v.status} label={v.statusLabel} />
                </TableCell>
                <TableCell>
                  <ComplianceCell compliance={v.compliance} />
                </TableCell>
                <TableCell>
                  <OverdueAmountCell vehicle={v} />
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <ActionCell vehicle={v} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function StatusCell({ status, label }: { status: Status; label: string }) {
  const dotClass =
    status === "active"
      ? "bg-primary"
      : status === "idle"
        ? "bg-muted-foreground/50"
        : status === "maintenance"
          ? "bg-secondary"
          : "bg-destructive/70"
  return (
    <p className="flex items-center gap-2 text-sm text-foreground">
      <span className={cn("size-1.5 shrink-0 rounded-full", dotClass)} />
      {label}
    </p>
  )
}

function OverdueAmountCell({ vehicle }: { vehicle: Vehicle }) {
  if (vehicle.compliance.kind !== "overdue") {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  const penalty = calculatePenalty(vehicle)
  return (
    <p className="leading-tight">
      <span className="text-sm font-semibold text-destructive tabular-nums">
        {formatMzn(penalty)}
        <span className="ml-1 text-[10px] font-medium text-destructive/70">MZN</span>
      </span>
      <span className="block text-[10px] text-muted-foreground">
        {vehicle.compliance.daysOverdue}d × {formatMzn(vehicle.compliance.penaltyDailyMzn)} MZN/day
      </span>
    </p>
  )
}

function ComplianceCell({ compliance }: { compliance: Compliance }) {
  const { label, badgeClass } = describeCompliance(compliance)
  return (
    <div className="flex flex-col gap-1 leading-tight">
      <Badge variant="secondary" className={cn("px-2 py-0.5 text-[11px]", badgeClass)}>
        {label}
      </Badge>
      <span className="text-[10px] text-muted-foreground">
        Exp {compliance.expDate}
      </span>
    </div>
  )
}

function describeCompliance(compliance: Compliance): {
  label: string
  badgeClass: string
} {
  switch (compliance.kind) {
    case "compliant":
      return { label: "Compliant", badgeClass: "bg-chart-1/60 text-primary" }
    case "renewal-soon":
      return {
        label: `Renewal in ${compliance.daysLeft}d`,
        badgeClass: "bg-accent text-accent-foreground",
      }
    case "overdue":
      return {
        label: `Overdue · ${compliance.daysOverdue}d`,
        badgeClass: "bg-destructive/10 text-destructive",
      }
    case "expired":
      return {
        label: "Expired",
        badgeClass: "bg-destructive/10 text-destructive",
      }
    case "disputed":
      return {
        label: "Disputed",
        badgeClass: "bg-accent text-secondary",
      }
  }
}

type RowAction = {
  label: string
  Icon: typeof Plus
  tone: "primary" | "destructive" | "muted"
}

function rowActionFor(v: Vehicle): RowAction {
  // Overdue trumps everything — it's the most urgent settlement signal.
  if (v.compliance.kind === "overdue" || v.compliance.kind === "expired") {
    return { label: "Pay", Icon: CreditCard, tone: "destructive" }
  }
  if (v.activeTrip) {
    return { label: "Top up", Icon: Plus, tone: "primary" }
  }
  return { label: "Start trip", Icon: Play, tone: "muted" }
}

function ActionCell({ vehicle }: { vehicle: Vehicle }) {
  const action = rowActionFor(vehicle)
  const Icon = action.Icon
  return (
    <NavLink
      to={`/pay-charges?vehicle=${encodeURIComponent(vehicle.plate)}`}
      aria-label={`${action.label} · ${vehicle.plate}`}
      className={cn(
        "ml-auto inline-flex w-28 items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        action.tone === "destructive" &&
          "border-destructive/30 bg-destructive/5 text-destructive hover:border-destructive/50 hover:bg-destructive/10",
        action.tone === "primary" &&
          "border-primary/30 bg-primary/5 text-primary hover:border-primary/50 hover:bg-primary/10",
        action.tone === "muted" &&
          "border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
      )}
    >
      <Icon className="size-3.5" />
      {action.label}
    </NavLink>
  )
}

const COLOR_SWATCH: Record<string, string> = {
  white: "bg-white border-border",
  black: "bg-zinc-900 border-zinc-900",
  red: "bg-red-500 border-red-500",
  blue: "bg-blue-500 border-blue-500",
  green: "bg-emerald-500 border-emerald-500",
  yellow: "bg-yellow-400 border-yellow-400",
  orange: "bg-orange-500 border-orange-500",
  silver: "bg-zinc-300 border-zinc-300",
}

function ColorCell({ color }: { color: string }) {
  const swatch = COLOR_SWATCH[color.toLowerCase()] ?? "bg-muted border-border"
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn("size-3.5 shrink-0 rounded-full border", swatch)}
      />
      <span className="text-sm text-foreground">{color}</span>
    </div>
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
          className="bg-card text-foreground px-2 py-0.5 text-[11px]"
        >
          {count} vehicle{count === 1 ? "" : "s"}
        </Badge>
      </div>
    </div>
  )
}
