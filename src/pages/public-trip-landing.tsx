import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CreditCard,
  LockKeyhole,
  MapPinned,
  Search,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { StatusPill } from "@/components/fleet/status-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  compactPlateNumber,
  type MotorVehicleLogbook,
} from "@/lib/motor-vehicle-api"
import { getApiErrorMessage } from "@/lib/api"
import {
  createPublicPrepaidTrip,
  getPublicPrepaidTripVehicleByPlate,
  listMunicipalRoutes,
  MUNICIPALITY_ID,
  type MunicipalRoute,
  type TripCreateResult,
  type TripInvoice,
} from "@/lib/trips-api"
import { WEIGHT_TIERS, weightTierForKg, type Vehicle } from "@/lib/fleet"
import { formatCurrencyMzn } from "@/i18n/format"
import { isHeavyVehicleWeightKg } from "@/lib/fleet-vehicle-classification"
import { classifyFleetVehicle, type WeightCategory } from "@/lib/v4-rules"
import { cn } from "@/lib/utils"

const DURATION_OPTIONS = [1, 2, 7, 14, 30] as const

const VEHICLE_IMAGES = [
  "/vehicle-weight-8-16.png",
  "/vehicle-weight-16-25.png",
  "/vehicle-weight-25-38.png",
  "/vehicle-weight-38-48.png",
  "/vehicle-weight-48-plus.png",
] as const

const VEHICLE_IMAGE_BY_WEIGHT_TIER: Record<
  (typeof WEIGHT_TIERS)[number]["key"],
  (typeof VEHICLE_IMAGES)[number]
> = {
  "8-16": VEHICLE_IMAGES[0],
  "16-25": VEHICLE_IMAGES[1],
  "25-38": VEHICLE_IMAGES[2],
  "38-48": VEHICLE_IMAGES[3],
  "48+": VEHICLE_IMAGES[4],
}

function normalizeCapacityKg(vehicle: MotorVehicleLogbook): number {
  const raw =
    vehicle.grossWeightTotalKg ??
    vehicle.logbookCapacityKg ??
    vehicle.currentLogbookCapacity ??
    0
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return raw <= 200 ? Math.round(raw * 1000) : Math.round(raw)
}

function plateLabel(plate: string | null | undefined): string {
  return (plate ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")
}

function motorVehicleToVehicle(record: MotorVehicleLogbook): Vehicle {
  const weightKg = normalizeCapacityKg(record)
  const makeModel = [record.make, record.model].filter(Boolean).join(" ")
  const year = record.registrationDate
    ? new Date(record.registrationDate).getFullYear()
    : new Date().getFullYear()
  const axles = weightKg >= 25_000 ? 4 : weightKg > 16_000 ? 3 : 2

  return {
    plate: plateLabel(record.plateNumber),
    ref: record.id,
    model: makeModel || record.truckNumber || "Motorvehicle record",
    year,
    axles,
    configuration: weightKg >= 25_000 ? "4x2 articulated" : "Rigid",
    weightKg,
    color: record.colour ?? "Not recorded",
    rucClass: isHeavyVehicleWeightKg(weightKg) ? "Heavy vehicle" : "Medium vehicle",
    chassisVin: record.vinOrChassis ?? record.id,
    engineNumber: record.engineNumber ?? "Not recorded",
    logbookRef: record.logbookNumber ?? record.logbookSeries ?? "MVR record",
    odometerKm: 0,
    status: "active",
    statusLabel: record.status ?? "Active",
    compliance: { kind: "compliant", expDate: "Not provided" },
    driver: null,
    authorisedDrivers: [],
    mtdSpend: 0,
    renewalFee: 0,
    activeTrip: null,
    recentTrips: [],
    documents: [],
    complianceSeries: [],
    trackingDevice: null,
  }
}

function routeLabel(route: MunicipalRoute) {
  return route.routeName ?? route.name ?? route.routeCode ?? route.id
}

function invoiceAmount(invoice: TripInvoice | null, fallback: number) {
  const value = invoice?.amount ?? invoice?.totalAmount
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function invoicePrn(invoice: TripInvoice | null) {
  return typeof invoice?.prn === "string" && invoice.prn
    ? invoice.prn
    : "PRN-STUB-PENDING"
}

function estimateTotal(vehicle: Vehicle | null, days: number) {
  if (!vehicle) return 0
  if (days === 30) return 20_000
  const tier = weightTierForKg(vehicle.weightKg) ?? WEIGHT_TIERS[0]
  return Math.min(tier.mznPerDay * days, 20_000)
}

function imageForWeightKg(weightKg: number) {
  const tier = weightTierForKg(weightKg)
  return tier ? VEHICLE_IMAGE_BY_WEIGHT_TIER[tier.key] : VEHICLE_IMAGES[0]
}

export default function PublicTripLanding() {
  const { t } = useTranslation()
  const [plate, setPlate] = useState("")
  const [record, setRecord] = useState<MotorVehicleLogbook | null>(null)
  const [durationDays, setDurationDays] = useState(2)
  const [routeId, setRouteId] = useState<string | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [result, setResult] = useState<TripCreateResult | null>(null)

  const vehicle = useMemo(
    () => (record ? motorVehicleToVehicle(record) : null),
    [record]
  )
  const category: WeightCategory | null = vehicle
    ? classifyFleetVehicle(vehicle)
    : null
  const isHeavy = category === "RESTRICTED_HEAVY"
  const total = invoiceAmount(
    result?.invoice ?? null,
    estimateTotal(vehicle, durationDays)
  )

  const routesQuery = useQuery({
    queryKey: ["public-municipal-routes", MUNICIPALITY_ID],
    queryFn: () => listMunicipalRoutes(MUNICIPALITY_ID, { skipAuth: true }),
    enabled: isHeavy && !!MUNICIPALITY_ID,
  })
  const routes = routesQuery.data ?? []

  const lookupVehicle = async () => {
    const compact = compactPlateNumber(plate)
    if (!compact) {
      setLookupError(t("landing.enterPlate"))
      return
    }
    setIsLookingUp(true)
    setLookupError(null)
    setResult(null)
    setRouteId(null)
    try {
      const next = await getPublicPrepaidTripVehicleByPlate(compact)
      const displayPlate = plateLabel(next.plateNumber || compact)
      setRecord(next)
      setPlate(displayPlate)
      toast.success(t("landing.vehicleFound"), {
        description: t("landing.vehicleFoundDescription", {
          plate: displayPlate,
        }),
      })
    } catch (error) {
      setRecord(null)
      setLookupError(
        error instanceof Error ? error.message : t("landing.vehicleNotFound")
      )
    } finally {
      setIsLookingUp(false)
    }
  }

  const createTrip = async () => {
    if (!vehicle) return
    if (!MUNICIPALITY_ID) {
      toast.error(t("landing.municipalityMissing"), {
        description: t("landing.municipalityMissingDescription"),
      })
      return
    }
    if (isHeavy && !routeId) return

    setIsCreating(true)
    try {
      const created = await createPublicPrepaidTrip({
        vehicleId: vehicle.ref,
        municipalityId: MUNICIPALITY_ID,
        paymentMode: "PREPAID",
        expectedDurationDays: durationDays,
        ...(routeId ? { routeId } : {}),
      })
      setResult(created)
      toast.success(t("landing.tripDeclared"), {
        description: t("landing.tripDeclaredDescription", {
          prn: invoicePrn(created.invoice),
        }),
      })
    } catch (error) {
      toast.error(t("landing.tripCreationFailed"), {
        description: getApiErrorMessage(error, t("landing.tryAgain")),
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-sidebar text-white">
      <img
        src="/landing.png"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,10,18,0.82)_0%,rgba(6,10,18,0.55)_42%,rgba(6,10,18,0.14)_100%)]" />
      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-7xl flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/maputo-logo.webp"
              alt={t("common.municipalityMaputo")}
              className="size-10 rounded-lg bg-white object-contain p-1"
            />
            <div>
              <p className="text-sm font-semibold tracking-tight">ILGARS</p>
              <p className="text-[10px] font-medium tracking-widest text-white/60 uppercase">
                {t("shell.publicTrip")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" className="rounded-lg">
              <Link to="/portal">
                <LockKeyhole className="size-4" />
                {t("shell.signIn")}
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,0.9fr)_520px]">
          <div className="max-w-2xl">
            <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
              {t("landing.noLoginRequired")}
            </Badge>
            <h1 className="mt-5 max-w-xl text-5xl leading-[0.95] font-semibold tracking-tight text-white sm:text-6xl">
              {t("landing.hero")}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/72">
              {t("landing.subhero")}
            </p>
            <div className="mt-7 grid max-w-xl grid-cols-3 gap-3">
              <Metric label={t("landing.metricLookup")} value="MVR" />
              <Metric label={t("landing.metricPayment")} value="PRN" />
              <Metric label={t("landing.metricCoverage")} value="1-30d" />
            </div>
          </div>

          <section className="rounded-xl border border-white/18 bg-white/92 p-4 text-foreground shadow-2xl backdrop-blur-md sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  {t("landing.createPrepaidTrip")}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  {t("landing.vehicleLookup")}
                </h2>
              </div>
              {category && (
                <StatusPill tone={isHeavy ? "warning" : "compliant"}>
                  {isHeavy ? t("common.routeRequired") : t("common.directPrn")}
                </StatusPill>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={plate}
                  onChange={(event) => {
                    setPlate(event.target.value.toUpperCase())
                    setLookupError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      void lookupVehicle()
                    }
                  }}
                  placeholder="AHS270MP"
                  className="h-10 rounded-lg pl-8 font-mono tracking-wide"
                />
              </div>
              <Button
                onClick={() => void lookupVehicle()}
                disabled={isLookingUp}
                className="h-10 rounded-lg"
              >
                {isLookingUp ? <Spinner /> : <Search className="size-4" />}
                {t("common.lookup")}
              </Button>
            </div>

            {lookupError && (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {lookupError}
              </p>
            )}

            {vehicle ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
                      <img
                        src={imageForWeightKg(vehicle.weightKg)}
                        alt=""
                        aria-hidden
                        className="h-full w-full object-contain p-1"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-lg font-semibold tracking-wide">
                        {vehicle.plate}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {vehicle.model} · {formatCurrencyMzn(vehicle.weightKg)}{" "}
                        kg
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <Fact
                      label={t("landing.logbook")}
                      value={vehicle.logbookRef}
                      mono
                    />
                    <Fact
                      label={t("common.operator")}
                      value={record?.operatorName ?? "-"}
                    />
                    <Fact label={t("common.class")} value={category ?? "-"} />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <CalendarDays className="size-4 text-muted-foreground" />
                    {t("landing.circulationPeriod")}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {DURATION_OPTIONS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => {
                          setDurationDays(days)
                          setResult(null)
                        }}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-sm font-semibold transition-colors",
                          durationDays === days
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:border-primary/40"
                        )}
                      >
                        {days === 30 ? "30d" : `${days}d`}
                      </button>
                    ))}
                  </div>
                </div>

                {isHeavy && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <MapPinned className="size-4 text-muted-foreground" />
                      {t("landing.heavyRoute")}
                    </div>
                    {routesQuery.isLoading ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner />
                        {t("landing.loadingRoutes")}
                      </p>
                    ) : routes.length > 0 ? (
                      <div className="max-h-40 space-y-1 overflow-y-auto">
                        {routes.map((route) => (
                          <button
                            key={route.id}
                            type="button"
                            onClick={() => {
                              setRouteId(route.id)
                              setResult(null)
                            }}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm",
                              routeId === route.id
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card hover:border-primary/30"
                            )}
                          >
                            <span className="truncate">
                              {routeLabel(route)}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {route.routeCode ?? route.id.slice(0, 8)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <UnknownRouteNotice />
                    )}
                    {routes.length > 0 && !routeId && <UnknownRouteNotice />}
                  </div>
                )}

                <Button
                  size="lg"
                  onClick={() => void createTrip()}
                  disabled={isCreating || (isHeavy && !routeId)}
                  className="w-full rounded-lg"
                >
                  {isCreating ? <Spinner /> : <CreditCard className="size-4" />}
                  {t("landing.generatePrn")}
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            ) : null}

            {result && (
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <BadgeCheck className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {t("landing.tripDeclaredGenerated")}
                    </p>
                    <p className="mt-1 font-mono text-lg font-semibold tracking-wide">
                      {invoicePrn(result.invoice)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("landing.tripAmount", {
                        tripId: result.trip.id,
                        amount: formatCurrencyMzn(total),
                        currency: result.invoice?.currency ?? "MZN",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-white/25 pl-3">
      <p className="text-[10px] font-semibold tracking-widest text-white/55 uppercase">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}

function Fact({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate font-medium text-foreground",
          mono && "font-mono"
        )}
      >
        {value || "-"}
      </p>
    </div>
  )
}

function UnknownRouteNotice() {
  const { t } = useTranslation()
  return (
    <div className="mt-2 rounded-md border border-secondary/40 bg-accent/60 p-3 text-xs leading-relaxed text-muted-foreground">
      {t("landing.unknownRouteNotice")}
    </div>
  )
}
