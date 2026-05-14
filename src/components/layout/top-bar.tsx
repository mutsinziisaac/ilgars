import { ArrowLeft, Bell, Plus, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
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
import { formatDate } from "@/i18n/format"
import { findNavItem } from "./nav-config"

const MOCK_TRUCK_COUNT = 12
const MOCK_COMPANY_COUNT = 1
const MOCK_CHEST_ID = "100184"

const FLEET_STEP_LABELS = ["logbook", "details", "photos", "review"] as const
const FLEET_STEP_TOTAL = FLEET_STEP_LABELS.length

const PAY_STEP_LABELS = ["vehicle", "charge", "payment"] as const
const PAY_STEP_TOTAL = PAY_STEP_LABELS.length

export function TopBar() {
  const { pathname } = useLocation()

  const onFleetNew = matchPath("/portal/fleet/new", pathname) !== null
  const detailMatch = matchPath("/portal/fleet/:vehicleId", pathname)
  const onFleetDetail = detailMatch !== null && !onFleetNew
  const onPayCharges = matchPath("/portal/pay-charges", pathname) !== null
  const onPermits = matchPath("/portal/permits", pathname) !== null

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
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-6">
      <div className="flex min-w-0 flex-col leading-tight">
        <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          {t("shell.permitsEyebrow")}
        </p>
        <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-foreground">
          {t("shell.myPermits")}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("common.searchPlatesReceipts")}
            className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
          />
        </div>
        <NotificationsButton />
        <Button
          size="sm"
          onClick={() => navigate("/portal/permits?mode=new")}
          className="rounded-lg bg-sidebar text-sidebar-foreground hover:bg-sidebar/90"
        >
          <Plus />
          {t("shell.newApplication")}
        </Button>
      </div>
    </header>
  )
}

function DefaultTopBar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isFleet = pathname === "/portal/fleet"
  const current = findNavItem(pathname)
  const today = formatDate(new Date(), "EEE d MMM yyyy")
  const displayName = user.firstName ?? user.displayName

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-6">
      <div className="flex min-w-0 flex-col leading-tight">
        {isFleet ? (
          <>
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {t("shell.fleetMeta", {
                trucks: MOCK_TRUCK_COUNT,
                companies: MOCK_COMPANY_COUNT,
                chestId: MOCK_CHEST_ID,
              })}
            </p>
            <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-foreground">
              {t("nav.myFleet")}
            </h1>
          </>
        ) : (
          <>
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {t("shell.portalMeta", {
                page: current ? t(current.labelKey) : t("shell.page"),
                date: today,
              })}
            </p>
            <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-foreground">
              {t("shell.greeting", { name: displayName })}
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
              placeholder={t("common.searchPlatesReceipts")}
              className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
            />
          </div>
        )}
        <NotificationsButton />
        {isFleet ? (
          <Button
            size="sm"
            onClick={() => navigate("/portal/fleet/new")}
            className="rounded-lg bg-sidebar text-sidebar-foreground hover:bg-sidebar/90"
          >
            <Plus />
            {t("fleet.addTruck")}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => navigate("/portal/pay-charges?step=vehicle")}
            className="rounded-lg bg-sidebar text-sidebar-foreground hover:bg-sidebar/90"
          >
            <Plus />
            {t("shell.newTrip")}
          </Button>
        )}
      </div>
    </header>
  )
}

function CreateTopBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const stepKey = (params.get("step") ??
    "logbook") as (typeof FLEET_STEP_LABELS)[number]
  const stepIndex = Math.max(0, FLEET_STEP_LABELS.indexOf(stepKey))
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-6">
      <div className="flex min-w-0 flex-col leading-tight">
        <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          {t("shell.vehicleRegisterStep", {
            current: stepIndex + 1,
            total: FLEET_STEP_TOTAL,
          })}
        </p>
        <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-foreground">
          {t("shell.registerNewVehicle")}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("common.searchPlatesReceipts")}
            className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
          />
        </div>
        <NotificationsButton />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/portal/fleet")}
          className="rounded-lg"
        >
          {t("common.saveExit")}
        </Button>
      </div>
    </header>
  )
}

function PayChargesTopBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const stepKey = (params.get("step") ??
    "vehicle") as (typeof PAY_STEP_LABELS)[number]
  const stepIndex = Math.max(0, PAY_STEP_LABELS.indexOf(stepKey))
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-6">
      <div className="flex min-w-0 flex-col leading-tight">
        <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          {t("shell.newTripStep", {
            current: stepIndex + 1,
            total: PAY_STEP_TOTAL,
          })}
        </p>
        <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-foreground">
          {t("shell.createTrip")}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("common.searchPlatesReceipts")}
            className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
          />
        </div>
        <NotificationsButton />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/portal")}
          className="rounded-lg"
        >
          {t("common.saveExit")}
        </Button>
      </div>
    </header>
  )
}

function DetailTopBar({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation()
  const eyebrow = t("shell.detailEyebrow")
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/portal/fleet"
          aria-label={t("shell.backToFleet")}
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
            placeholder={t("common.searchPlatesReceipts")}
            className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
          />
        </div>
        <NotificationsButton />
      </div>
    </header>
  )
}

function NotificationsButton() {
  const { t } = useTranslation()
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="relative rounded-lg"
      aria-label={t("shell.notifications")}
    >
      <Bell className="size-3.5" />
      <span
        aria-hidden
        className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-secondary ring-2 ring-card"
      />
    </Button>
  )
}
