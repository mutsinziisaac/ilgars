import { format } from "date-fns"
import {
  ArrowLeft,
  Bell,
  Plus,
  Search,
} from "lucide-react"
import {
  Link,
  matchPath,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom"

import { useAuth } from "@/components/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { findNavItem } from "./nav-config"

const MOCK_FLEET_COUNT = 8
const MOCK_COMPANY_COUNT = 1
const MOCK_CHEST_ID = "100184"

const FLEET_STEP_LABELS = ["logbook", "details", "photos", "review"] as const
const FLEET_STEP_TOTAL = FLEET_STEP_LABELS.length

const PAY_STEP_LABELS = ["vehicle", "charge", "payment"] as const
const PAY_STEP_TOTAL = PAY_STEP_LABELS.length

export function TopBar() {
  const { pathname } = useLocation()

  const onFleetNew = matchPath("/fleet/new", pathname) !== null
  const detailMatch = matchPath("/fleet/:vehicleId", pathname)
  const onFleetDetail = detailMatch !== null && !onFleetNew
  const onPayCharges = matchPath("/pay-charges", pathname) !== null
  const onPermits = matchPath("/permits", pathname) !== null

  if (onFleetNew) return <CreateTopBar />
  if (onFleetDetail) {
    const vehicleId = decodeURIComponent(detailMatch!.params.vehicleId ?? "")
    return <DetailTopBar vehicleId={vehicleId} />
  }
  if (onPayCharges) return <PayChargesTopBar />
  if (onPermits) return <PermitsTopBar />
  return <DefaultTopBar />
}

function PermitsTopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-6">
      <div className="flex min-w-0 flex-col leading-tight">
        <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          Road closure & restriction applications
        </p>
        <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-foreground">
          My permits
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search plates, receipts…"
            className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
          />
        </div>
        <NotificationsButton />
        <Button
          size="sm"
          className="rounded-lg bg-sidebar text-sidebar-foreground hover:bg-sidebar/90"
        >
          <Plus />
          New application
        </Button>
      </div>
    </header>
  )
}

function DefaultTopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isFleet = pathname === "/fleet"
  const current = findNavItem(pathname)
  const today = format(new Date(), "EEE d MMM yyyy")
  const displayName = user.firstName ?? user.displayName

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-6">
      <div className="flex min-w-0 flex-col leading-tight">
        {isFleet ? (
          <>
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {MOCK_FLEET_COUNT} vehicles · {MOCK_COMPANY_COUNT} company · Chest
              ID {MOCK_CHEST_ID}
            </p>
            <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-foreground">
              My fleet
            </h1>
          </>
        ) : (
          <>
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {current?.label ?? "Page"} · {today}
            </p>
            <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-foreground">
              Boa tarde, {displayName}
            </h1>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!isFleet && (
          <div className="relative w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search plates, receipts…"
              className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
            />
          </div>
        )}
        <NotificationsButton />
        {isFleet ? (
          <Button
            size="sm"
            onClick={() => navigate("/fleet/new")}
            className="rounded-lg bg-sidebar text-sidebar-foreground hover:bg-sidebar/90"
          >
            <Plus />
            New register
          </Button>
        ) : (
          <Button
            size="sm"
            className="rounded-lg bg-sidebar text-sidebar-foreground hover:bg-sidebar/90"
          >
            <Plus />
            New trip
          </Button>
        )}
      </div>
    </header>
  )
}

function CreateTopBar() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const stepKey = (params.get("step") ??
    "logbook") as (typeof FLEET_STEP_LABELS)[number]
  const stepIndex = Math.max(0, FLEET_STEP_LABELS.indexOf(stepKey))
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-6">
      <div className="flex min-w-0 flex-col leading-tight">
        <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          My fleet · UC-002 · Step {stepIndex + 1} of {FLEET_STEP_TOTAL}
        </p>
        <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-foreground">
          Register a new vehicle
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search plates, receipts…"
            className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
          />
        </div>
        <NotificationsButton />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/fleet")}
          className="rounded-lg"
        >
          Save & exit
        </Button>
      </div>
    </header>
  )
}

function PayChargesTopBar() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const stepKey = (params.get("step") ??
    "vehicle") as (typeof PAY_STEP_LABELS)[number]
  const stepIndex = Math.max(0, PAY_STEP_LABELS.indexOf(stepKey))
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-6">
      <div className="flex min-w-0 flex-col leading-tight">
        <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          New transaction · Step {stepIndex + 1} of {PAY_STEP_TOTAL}
        </p>
        <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-foreground">
          Pay road user charges
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search plates, receipts…"
            className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
          />
        </div>
        <NotificationsButton />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="rounded-lg"
        >
          Save & exit
        </Button>
      </div>
    </header>
  )
}

function DetailTopBar({ vehicleId }: { vehicleId: string }) {
  const eyebrow = "My fleet · Vehicle"
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/fleet"
          aria-label="Back to fleet"
          className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex min-w-0 flex-col leading-tight">
          <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-0.5 truncate font-mono text-xl font-semibold tracking-wider text-foreground">
            {vehicleId}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search plates, receipts…"
            className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
          />
        </div>
        <NotificationsButton />
      </div>
    </header>
  )
}

function NotificationsButton() {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="relative rounded-lg"
      aria-label="Notifications"
    >
      <Bell className="size-3.5" />
      <span
        aria-hidden
        className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-secondary ring-2 ring-card"
      />
    </Button>
  )
}
