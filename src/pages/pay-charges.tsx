import { useEffect, useMemo, useState } from "react"
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns"
import {
  AlertTriangle,
  Anchor,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Map as MapIcon,
  Mail,
  MessageSquare,
  Moon,
  Paperclip,
  Plus,
  QrCode,
  RefreshCcw,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Smartphone,
  Truck,
  UserPlus,
  Wallet,
  XCircle,
} from "lucide-react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import type { DateRange } from "react-day-picker"

import { useAuth } from "@/components/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { VerticalStepper, type Step } from "@/components/fleet/vertical-stepper"
import { VehicleIllustration } from "@/components/fleet/vehicle-illustration"
import { StatusPill } from "@/components/fleet/status-pill"
import {
  FLEET,
  MONTHLY_CAP_MZN,
  WALLET_BALANCE_MZN,
  WEIGHT_TIERS,
  calculatePenalty,
  findVehicleByPlate,
  formatMzn,
  normalisePlate,
  simulatePaymentResult,
  weightTierForKg,
  type PaymentChannel,
  type PaymentResult,
  type Vehicle,
} from "@/lib/fleet"
import {
  classifyFleetVehicle,
  evaluateAccess,
  hasOpenPostpaidBalance,
  resolveFee,
  validateApplication,
  NIGHT_WINDOW_LABEL,
  type AccessDecision,
  type LicenceType,
  type WeightCategory,
} from "@/lib/v4-rules"
import {
  getDesignatedRoutes,
  getPortCorridorRoutes,
  isOffListRoute,
  lookupRoute,
  OFF_LIST_ROUTE,
  type Route,
} from "@/lib/routes"
import {
  lifecycleFor,
  statusLabel,
  submitApplication,
  type LicenceApplication,
} from "@/lib/authorisations"
import type { FleetVehicle } from "@/lib/fleet-vehicles-api"
import { capacityTonnes } from "@/lib/fleet-vehicle-classification"
import { createTrip, MUNICIPALITY_ID } from "@/lib/trips-api"
import { cn } from "@/lib/utils"

type StepKey =
  | "vehicle"
  | "charge"
  | "invoice"
  | "payment"
  | "processing"
  | "receipt"
  | "route"
  | "window"
  | "attachments"
  | "review"
  | "submitted"

type WizardPath = "pay-now" | "submit-application"

const PAY_NOW_VISIBLE_STEPS: readonly Step<StepKey>[] = [
  { key: "vehicle", label: "Vehicle", description: "Select from your fleet" },
  {
    key: "charge",
    label: "Charge & duration",
    description: "Pick licence + dates",
  },
  { key: "invoice", label: "Invoice", description: "Review fees + deadline" },
  {
    key: "payment",
    label: "Payment method",
    description: "Mobile, card, wallet",
  },
]

const SUBMIT_VISIBLE_STEPS: readonly Step<StepKey>[] = [
  { key: "vehicle", label: "Vehicle", description: "Select from your fleet" },
  {
    key: "route",
    label: "Route",
    description: "Designated · port · or off-list",
  },
  {
    key: "window",
    label: "Operating window",
    description: "Dates · time window",
  },
  {
    key: "attachments",
    label: "Attachments",
    description: "Required for exceptional",
  },
  {
    key: "review",
    label: "Review & submit",
    description: "Lodge for verification",
  },
]

function visibleStepsFor(
  path: WizardPath,
  licenceType: LicenceType | null
): readonly Step<StepKey>[] {
  if (path === "pay-now") return PAY_NOW_VISIBLE_STEPS
  // Attachments only appear for EXCEPTIONAL.
  if (licenceType === "EXCEPTIONAL") return SUBMIT_VISIBLE_STEPS
  return SUBMIT_VISIBLE_STEPS.filter((s) => s.key !== "attachments")
}

function stepIndex(
  path: WizardPath,
  licenceType: LicenceType | null
): Record<StepKey, number> {
  // Indices are only consulted for back-navigation; out-of-path keys map to -1.
  const visible = visibleStepsFor(path, licenceType).map((s) => s.key)
  const map: Partial<Record<StepKey, number>> = {}
  visible.forEach((key, i) => {
    map[key] = i
  })
  // Terminal/intermediary steps that never appear in the rail.
  if (path === "pay-now") {
    map.processing = visible.length
    map.receipt = visible.length + 1
  } else {
    map.processing = visible.length
    map.submitted = visible.length + 1
  }
  return map as Record<StepKey, number>
}

const DURATION_PRESETS = [1, 3, 5, 7, 14, 30] as const

type ChargeKind = "cargo" | "special"

type ChargeOption = {
  kind: ChargeKind
  title: string
  subtitle: string
  rateLabel: string
  recommended?: boolean
  disabled?: boolean
  disabledReason?: string
  /** Days × dailyMzn drives total. For "special", monthlyMzn flat. */
  dailyMzn?: number
  monthlyMzn?: number
}

const PAYMENT_CHANNELS: {
  key: PaymentChannel
  title: string
  subtitle: string
  icon: typeof Smartphone
}[] = [
  {
    key: "mobile",
    title: "Mobile money",
    subtitle: "M-Pesa · e-Mola · mKesh",
    icon: Smartphone,
  },
  {
    key: "card",
    title: "Card",
    subtitle: "Visa, Mastercard",
    icon: CreditCard,
  },
  {
    key: "wallet",
    title: "Wallet",
    subtitle: `Balance ${formatMzn(WALLET_BALANCE_MZN)} MZN`,
    icon: Wallet,
  },
]

function paymentChannelLabel(channel: PaymentChannel): string {
  return PAYMENT_CHANNELS.find((c) => c.key === channel)?.title ?? channel
}

type Attachments = {
  livreteFilename?: string
  titleFilename?: string
  justification?: string
  escortRequestRef?: string
}

type FormState = {
  vehicle: Vehicle | null
  chargeKind: ChargeKind
  durationDays: number
  range: DateRange
  channel: PaymentChannel
  result: PaymentResult | null
  // Path B — RESTRICTED_HEAVY application flow
  routeCode: string | null
  attachments: Attachments
  application: LicenceApplication | null
}

type PayChargesLocationState = {
  fleetVehicle?: FleetVehicle
}

const today0 = startOfDay(new Date(2026, 4, 4)) // Mon 4 May 2026 — match the spec's reference date
const initialEnd = addDays(today0, 4)
const CURRENT_PERIOD = format(today0, "yyyy-MM")
const PAYMENT_DEADLINE = addDays(today0, 7)

const INITIAL_STATE: FormState = {
  vehicle: null,
  chargeKind: "cargo",
  durationDays: 5,
  range: { from: today0, to: initialEnd },
  channel: "mobile",
  result: null,
  routeCode: null,
  attachments: {},
  application: null,
}

function adaptFleetVehicleForPayment(vehicle: FleetVehicle): Vehicle {
  const tonnes = Math.max(1, capacityTonnes(vehicle))
  const weightKg = Math.round(tonnes * 1000)
  const vehicleStatusLabel = vehicle.status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

  return {
    plate: vehicle.plateNumberSnapshot,
    ref: vehicle.vehicleId,
    model: vehicle.truckNumberSnapshot || "Fleet vehicle",
    year: new Date(vehicle.vehicleSnapshotAt || vehicle.addedAt).getFullYear(),
    axles: 2,
    configuration: "Rigid",
    weightKg,
    color: "Fleet",
    rucClass: tonnes > 8 ? "Heavy vehicle" : "Medium vehicle",
    chassisVin: vehicle.vehicleId,
    engineNumber: vehicle.id,
    logbookRef: vehicle.registryStatus,
    odometerKm: 0,
    status: vehicle.status === "ACTIVE" ? "active" : "idle",
    statusLabel: vehicleStatusLabel,
    compliance: vehicle.compliantForRating
      ? { kind: "compliant", expDate: "Not provided" }
      : { kind: "expired", expDate: "Not provided" },
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

export default function PayCharges() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const stepParam = (params.get("step") ?? "vehicle") as StepKey
  const preselectedPlate = params.get("vehicle")
  const preselectedVehicleId = params.get("vehicleId")
  const stateFleetVehicle = (location.state as PayChargesLocationState | null)
    ?.fleetVehicle

  const [form, setForm] = useState<FormState>(() => {
    if (preselectedPlate) {
      const v = findVehicleByPlate(preselectedPlate)
      if (v) return { ...INITIAL_STATE, vehicle: v }
    }
    if (stateFleetVehicle) {
      return {
        ...INITIAL_STATE,
        vehicle: adaptFleetVehicleForPayment(stateFleetVehicle),
        durationDays: 2,
        range: { from: today0, to: addDays(today0, 1) },
      }
    }
    return INITIAL_STATE
  })

  // AC-01 — derive path + decision from current selections.
  const weightCategory: WeightCategory | null = form.vehicle
    ? classifyFleetVehicle(form.vehicle)
    : null
  const route: Route | null = form.routeCode
    ? (lookupRoute(form.routeCode) ?? null)
    : null
  const decision: AccessDecision | null = weightCategory
    ? evaluateAccess({
        weightCategory,
        routeCategory: route?.routeCategory,
      })
    : null
  const path: WizardPath =
    decision?.path === "submit-application" ? "submit-application" : "pay-now"
  const licenceType: LicenceType | null = decision?.licenceType ?? null
  const visibleSteps = visibleStepsFor(path, licenceType)
  const indexMap = stepIndex(path, licenceType)

  // Vehicle was selected upstream (from the fleet table) — skip the in-wizard vehicle step.
  const vehiclePreselected = !!preselectedPlate && !!form.vehicle
  const entryStepFor = (p: WizardPath): StepKey =>
    p === "submit-application" ? "route" : "charge"

  // Validate the URL step against the current path; snap to a sensible step when the URL is
  // out of sync with the active path or when the vehicle was preselected from the fleet.
  const step: StepKey = (() => {
    // Preselected: never show the vehicle picker; jump straight to the path's entry step.
    if (
      vehiclePreselected &&
      (stepParam === "vehicle" || indexMap[stepParam] === undefined)
    ) {
      return entryStepFor(path)
    }
    if (indexMap[stepParam] === undefined) return "vehicle"
    if (
      path === "pay-now" &&
      (stepParam === "route" ||
        stepParam === "window" ||
        stepParam === "attachments" ||
        stepParam === "review" ||
        stepParam === "submitted")
    ) {
      return vehiclePreselected ? "charge" : "vehicle"
    }
    if (
      path === "submit-application" &&
      (stepParam === "charge" ||
        stepParam === "invoice" ||
        stepParam === "payment" ||
        stepParam === "receipt")
    ) {
      return vehiclePreselected ? "route" : "vehicle"
    }
    return stepParam
  })()

  useEffect(() => {
    if (params.get("step") !== step) {
      const next = new URLSearchParams(params)
      next.set("step", step)
      setParams(next, { replace: true })
    }
  }, [params, setParams, step])

  const goTo = (next: StepKey) => {
    const updated = new URLSearchParams(params)
    updated.set("step", next)
    setParams(updated)
  }
  const back = () => {
    const i = indexMap[step]
    if (i === undefined || i === 0) {
      navigate(-1)
      return
    }
    const prev =
      visibleSteps[Math.max(0, Math.min(i - 1, visibleSteps.length - 1))]
    // When the vehicle was preselected from the fleet, the vehicle step is read-only context
    // in the rail; back-navigation should exit the wizard rather than re-enter selection.
    if (vehiclePreselected && prev.key === "vehicle") {
      navigate(-1)
      return
    }
    goTo(prev.key)
  }

  const submitPayment = async () => {
    if (!form.vehicle) return
    const opt = activeOption(form)
    if (!opt) return
    const tripVehicleId = preselectedVehicleId?.trim()
    if (!tripVehicleId) {
      toast.error("Vehicle ID missing", {
        description:
          "Open Pay Road User Charges from a fleet vehicle before creating a trip.",
      })
      return
    }
    if (!MUNICIPALITY_ID) {
      toast.error("Municipality ID missing", {
        description: "Set VITE_MUNICIPALITY_ID in the environment.",
      })
      return
    }

    const subtotal = orderSubtotal(form)
    const cap = Math.min(subtotal, MONTHLY_CAP_MZN)
    const capAdjustment = subtotal - cap
    const penalty = calculatePenalty(form.vehicle)
    const total = cap + penalty
    const fromIso = (form.range.from ?? today0).toISOString()
    const toIso = (form.range.to ?? form.range.from ?? today0).toISOString()
    const tier = cargoTierForVehicle(form.vehicle)
    const category =
      opt.kind === "cargo" ? `Cargo licence · ${tier.label}` : opt.title

    goTo("processing")
    const result = await simulatePaymentResult({
      vehicle: form.vehicle,
      category,
      durationDays: opt.kind === "special" ? 30 : form.durationDays,
      rangeFromIso: fromIso,
      rangeToIso: toIso,
      subtotalMzn: subtotal,
      penaltyMzn: penalty,
      capAdjustmentMzn: capAdjustment,
      totalMzn: total,
      channel: form.channel,
      channelLabel: paymentChannelLabel(form.channel),
      status: form.channel === "bank" ? "pending-reconciliation" : "paid",
    })
    setForm((f) => ({ ...f, result }))
    if (result.kind === "failure") {
      goTo("payment")
      return
    }

    try {
      await createTrip({
        vehicleId: tripVehicleId,
        municipalityId: MUNICIPALITY_ID,
        paymentMode: "PREPAID",
        createdBy: user.displayName,
        reason: "pre-declared before Maputo entry",
        expectedDurationDays: opt.kind === "special" ? 30 : form.durationDays,
      })
      toast.success("Trip created", {
        description: `${form.vehicle.plate} was pre-declared for Maputo entry.`,
      })
      goTo("receipt")
    } catch (error) {
      toast.error("Trip creation failed", {
        description:
          error instanceof Error ? error.message : "Try again before leaving.",
      })
      goTo("payment")
    }
  }

  const submitForReview = async () => {
    if (!form.vehicle || !route || !decision) return
    const fee = resolveFee({
      vehicle: form.vehicle,
      licenceType: decision.licenceType,
      durationDays: form.durationDays,
    })
    goTo("processing")
    const application = await submitApplication({
      vehicle: form.vehicle,
      route,
      licenceType: decision.licenceType,
      durationDays: form.durationDays,
      feeDueOnActivationMzn: fee.totalMzn,
      attachments: form.attachments,
    })
    setForm((f) => ({ ...f, application }))
    goTo("submitted")
  }

  const isTerminal =
    step === "processing" || step === "receipt" || step === "submitted"
  const showRail = !isTerminal

  return (
    <div
      className={cn(
        "gap-8 pt-2 pb-20",
        showRail
          ? "grid grid-cols-[220px_minmax(0,1fr)_320px]"
          : "mx-auto flex max-w-3xl flex-col"
      )}
    >
      {showRail && (
        <aside className="sticky top-20 self-start">
          <VerticalStepper
            steps={visibleSteps}
            currentKey={step}
            onJump={(k) => {
              // Vehicle is locked when preselected — it's shown as completed for context only.
              if (vehiclePreselected && k === "vehicle") return
              goTo(k)
            }}
          />
        </aside>
      )}

      <div className="flex flex-col gap-5">
        {step === "vehicle" && (
          <VehicleStep
            selected={form.vehicle}
            onSelect={(v) => {
              const cat = classifyFleetVehicle(v)
              setForm({
                ...INITIAL_STATE,
                vehicle: v,
                chargeKind: defaultChargeForVehicle(),
                routeCode: null,
                attachments: {},
                application: null,
                durationDays: cat === "RESTRICTED_HEAVY" ? 1 : 5,
              })
            }}
            onContinue={() =>
              goTo(weightCategory === "RESTRICTED_HEAVY" ? "route" : "charge")
            }
          />
        )}

        {/* ── Path A — pay-now (MEDIUM_HEAVY) ── */}
        {step === "charge" && form.vehicle && path === "pay-now" && (
          <ChargeStep
            form={form}
            setForm={setForm}
            onBack={back}
            onContinue={() => goTo("invoice")}
          />
        )}
        {step === "charge" && !form.vehicle && (
          <NoVehicleNotice onPick={() => goTo("vehicle")} />
        )}
        {step === "invoice" && form.vehicle && path === "pay-now" && (
          <InvoiceStep
            form={form}
            onBack={back}
            onContinue={() => goTo("payment")}
          />
        )}
        {step === "invoice" && !form.vehicle && (
          <NoVehicleNotice onPick={() => goTo("vehicle")} />
        )}
        {step === "payment" && form.vehicle && (
          <PaymentStep
            form={form}
            setForm={setForm}
            onBack={back}
            onSubmit={submitPayment}
          />
        )}
        {step === "payment" && !form.vehicle && (
          <NoVehicleNotice onPick={() => goTo("vehicle")} />
        )}

        {/* ── Path B — submit-and-wait (RESTRICTED_HEAVY) ── */}
        {step === "route" && form.vehicle && path === "submit-application" && (
          <RouteStep
            form={form}
            setForm={setForm}
            onBack={back}
            onContinue={() => goTo("window")}
          />
        )}
        {step === "window" && form.vehicle && path === "submit-application" && (
          <WindowStep
            form={form}
            setForm={setForm}
            decision={decision!}
            onBack={back}
            onContinue={() => {
              if (decision?.licenceType === "EXCEPTIONAL") goTo("attachments")
              else goTo("review")
            }}
          />
        )}
        {step === "attachments" &&
          form.vehicle &&
          path === "submit-application" && (
            <AttachmentsStep
              form={form}
              setForm={setForm}
              onBack={back}
              onContinue={() => goTo("review")}
            />
          )}
        {step === "review" &&
          form.vehicle &&
          path === "submit-application" &&
          route &&
          decision && (
            <ReviewSubmitStep
              form={form}
              decision={decision}
              route={route}
              onBack={back}
              onSubmit={submitForReview}
            />
          )}

        {step === "processing" && form.vehicle && path === "pay-now" && (
          <ProcessingStep form={form} />
        )}
        {step === "processing" &&
          form.vehicle &&
          path === "submit-application" && <SubmittingStep />}
        {step === "receipt" && form.vehicle && form.result && (
          <ReceiptStep
            result={form.result}
            onPayAnother={() => {
              setForm({ ...INITIAL_STATE })
              goTo("vehicle")
            }}
            onViewTransactions={() => navigate("/transactions")}
          />
        )}
        {step === "submitted" && form.application && (
          <SubmittedStep
            application={form.application}
            onSubmitAnother={() => {
              setForm({ ...INITIAL_STATE })
              goTo("vehicle")
            }}
            onViewApplications={() => navigate("/permits")}
          />
        )}
      </div>

      {showRail && (
        <aside className="sticky top-20 flex flex-col gap-4 self-start">
          {path === "pay-now" ? (
            <>
              <OrderSummary
                form={form}
                step={step}
                onPrimary={
                  step === "payment"
                    ? submitPayment
                    : () =>
                        goTo(
                          step === "vehicle"
                            ? weightCategory === "RESTRICTED_HEAVY"
                              ? "route"
                              : "charge"
                            : step === "charge"
                              ? "invoice"
                              : "payment"
                        )
                }
                primaryDisabled={
                  step === "vehicle"
                    ? !form.vehicle
                    : step === "charge"
                      ? !isChargeStepValid(form)
                      : false
                }
              />
              {step !== "vehicle" && <CapApplies />}
            </>
          ) : (
            <SubmissionPreview
              form={form}
              decision={decision}
              route={route}
              step={step}
              onPrimary={() => {
                if (step === "vehicle") goTo("route")
                else if (step === "route") goTo("window")
                else if (step === "window") {
                  if (decision?.licenceType === "EXCEPTIONAL")
                    goTo("attachments")
                  else goTo("review")
                } else if (step === "attachments") goTo("review")
                else if (step === "review") void submitForReview()
              }}
              primaryDisabled={
                step === "vehicle"
                  ? !form.vehicle
                  : step === "route"
                    ? !route
                    : step === "window"
                      ? !form.range.from || !form.range.to
                      : step === "attachments"
                        ? validateApplication({
                            vehicle: form.vehicle!,
                            route,
                            licenceType: decision!.licenceType,
                            durationDays: form.durationDays,
                            attachments: form.attachments,
                            deviceActive: true,
                            hasOpenPostpaidBalance: hasOpenPostpaidBalance(
                              form.vehicle!
                            ),
                          }).length > 0
                        : false
              }
            />
          )}
        </aside>
      )}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function cargoTierForVehicle(v: Vehicle) {
  return weightTierForKg(v.weightKg) ?? WEIGHT_TIERS[0]
}

function defaultChargeForVehicle(): ChargeKind {
  return "cargo"
}

function chargeOptionsFor(v: Vehicle): ChargeOption[] {
  const tier = cargoTierForVehicle(v)
  return [
    {
      kind: "cargo",
      title: `Cargo · ${tier.rangeLabel.replace(" kg", " kg")}`,
      subtitle: `${formatMzn(tier.mznPerDay)} MZN per day`,
      rateLabel: `${formatMzn(tier.mznPerDay)} MZN/day`,
      recommended: true,
      dailyMzn: tier.mznPerDay,
    },
    {
      kind: "special",
      title: "Special Circulation Licence",
      subtitle: `${formatMzn(20_000)} MZN per month`,
      rateLabel: "20,000 MZN/month",
      monthlyMzn: 20_000,
    },
  ]
}

function activeOption(form: FormState): ChargeOption | null {
  if (!form.vehicle) return null
  return (
    chargeOptionsFor(form.vehicle).find((o) => o.kind === form.chargeKind) ??
    null
  )
}

function orderSubtotal(form: FormState): number {
  const opt = activeOption(form)
  if (!opt) return 0
  if (opt.kind === "special") return opt.monthlyMzn ?? 0
  return (opt.dailyMzn ?? 0) * form.durationDays
}

/** Subtotal capped at the monthly ceiling — penalty (if any) is added on top. */
function cappedFee(form: FormState): number {
  return Math.min(orderSubtotal(form), MONTHLY_CAP_MZN)
}

function capAdjustment(form: FormState): number {
  return orderSubtotal(form) - cappedFee(form)
}

function orderPenalty(form: FormState): number {
  return form.vehicle ? calculatePenalty(form.vehicle) : 0
}

function orderTotal(form: FormState): number {
  return cappedFee(form) + orderPenalty(form)
}

function categoryLabel(form: FormState): string {
  const opt = activeOption(form)
  if (!opt) return "—"
  if (opt.kind === "cargo" && form.vehicle) {
    const tier = cargoTierForVehicle(form.vehicle)
    return `Cargo · ${tier.label}`
  }
  return opt.title
}

function isChargeStepValid(form: FormState): boolean {
  if (!form.vehicle) return false
  const opt = activeOption(form)
  if (!opt || opt.disabled) return false
  if (opt.kind !== "special" && form.durationDays <= 0) return false
  if (!form.range.from || !form.range.to) return false
  return true
}

// ── Step: Vehicle ───────────────────────────────────────────────────────────
function VehicleStep({
  selected,
  onSelect,
  onContinue,
}: {
  selected: Vehicle | null
  onSelect: (v: Vehicle) => void
  onContinue: () => void
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return FLEET
    return FLEET.filter(
      (v) =>
        v.plate.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.driver?.name.toLowerCase().includes(q)
    )
  }, [query])

  const trimmedQuery = query.trim()
  const looksLikePlate = /^[A-Z]{3} \d{3} MC$/.test(
    normalisePlate(trimmedQuery)
  )
  const showUnregisteredCta = filtered.length === 0 && looksLikePlate

  return (
    <Card>
      <SectionHeader
        eyebrow="Vehicle"
        description="Pick the vehicle you're paying for. Class and weight drive the recommended tariff."
      />
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plate, model, driver…"
          className="h-9 rounded-lg pl-8 text-sm"
        />
      </div>
      {showUnregisteredCta && (
        <UnregisteredVehicleCard plate={normalisePlate(trimmedQuery)} />
      )}
      {filtered.length === 0 && !looksLikePlate && (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
          No vehicles match "{trimmedQuery}". Try a plate (e.g.{" "}
          <span className="font-mono">AAB 482 MC</span>) or driver name.
        </p>
      )}
      {filtered.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {filtered.map((v) => {
            const isSelected = selected?.plate === v.plate
            const tier = cargoTierForVehicle(v)
            const pill = compliancePill(v)
            return (
              <li key={v.plate}>
                <button
                  type="button"
                  onClick={() => onSelect(v)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/30"
                  )}
                >
                  <VehicleIllustration axles={v.axles} />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold tracking-wider text-foreground">
                      {v.plate}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {v.model} · {formatMzn(v.weightKg)} kg · {tier.label}
                    </p>
                  </div>
                  <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          size="lg"
          onClick={onContinue}
          disabled={!selected}
          className="rounded-lg"
        >
          Continue to charge
          <ArrowRight />
        </Button>
      </div>
    </Card>
  )
}

function compliancePill(v: Vehicle): {
  tone: "compliant" | "renewal-soon" | "warning" | "critical"
  label: string
} {
  switch (v.compliance.kind) {
    case "compliant":
      return { tone: "compliant", label: "Compliant" }
    case "renewal-soon":
      return {
        tone: "renewal-soon",
        label: `Renewal in ${v.compliance.daysLeft}d`,
      }
    case "overdue":
      return {
        tone: "critical",
        label: `Overdue · ${v.compliance.daysOverdue}d`,
      }
    case "expired":
      return { tone: "critical", label: "Expired" }
    case "disputed":
      return { tone: "warning", label: "Disputed" }
  }
}

function UnregisteredVehicleCard({ plate }: { plate: string }) {
  const returnTo = `/pay-charges?step=vehicle`
  return (
    <div className="flex items-start gap-3 rounded-xl border border-secondary/40 bg-accent/60 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary/20 text-secondary">
        <UserPlus className="size-4" />
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">
          {plate} isn't in your fleet yet
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          Register it now (we'll pull logbook data from MVR if available) and
          resume payment when you're done.
        </p>
      </div>
      <Button asChild size="sm" className="rounded-md">
        <Link
          to={`/fleet/new?plate=${encodeURIComponent(plate)}&returnTo=${encodeURIComponent(returnTo)}`}
        >
          Register vehicle
          <ArrowRight />
        </Link>
      </Button>
    </div>
  )
}

// ── Step: Charge & duration ─────────────────────────────────────────────────
function ChargeStep({
  form,
  setForm,
  onBack,
  onContinue,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onBack: () => void
  onContinue: () => void
}) {
  const vehicle = form.vehicle!
  const options = useMemo(() => chargeOptionsFor(vehicle), [vehicle])
  const opt = activeOption(form)
  const isMonthly = opt?.kind === "special"

  const tier = cargoTierForVehicle(vehicle)

  const overdueRange = useMemo<{ from: Date; to: Date } | null>(() => {
    if (vehicle.compliance.kind !== "overdue") return null
    return {
      from: addDays(today0, -vehicle.compliance.daysOverdue),
      to: addDays(today0, -1),
    }
  }, [vehicle])

  const setDays = (days: number) => {
    setForm((f) => {
      const from = f.range.from ?? today0
      return {
        ...f,
        durationDays: days,
        range: { from, to: addDays(from, Math.max(0, days - 1)) },
      }
    })
  }

  const setRange = (range: DateRange | undefined) => {
    if (!range?.from) return
    const from = range.from
    const to = range.to ?? from
    const days = differenceInCalendarDays(to, from) + 1
    setForm((f) => ({
      ...f,
      range: { from, to },
      durationDays: days,
    }))
  }

  return (
    <>
      <Card>
        <SectionHeader
          eyebrow="Charge category"
          description={`Recommended bracket from MVR weight class · ${tier.label} · ${formatMzn(tier.mznPerDay)} MZN/day`}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {options.map((option) => (
            <ChargeOptionCard
              key={option.kind}
              option={option}
              selected={form.chargeKind === option.kind}
              onSelect={() =>
                setForm((f) => ({ ...f, chargeKind: option.kind }))
              }
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Duration"
          description={
            isMonthly
              ? "Special licence covers a calendar month."
              : "Pick a duration preset, or drag a range on the calendar."
          }
        />
        {!isMonthly && (
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((d) => {
              const active = form.durationDays === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    active
                      ? "border-sidebar bg-sidebar text-sidebar-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  {d} {d === 1 ? "day" : "days"}
                </button>
              )
            })}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DateBlock
            label="Starts"
            date={form.range.from}
            sub={
              form.range.from &&
              startOfDay(form.range.from).getTime() === today0.getTime()
                ? "00:00 today"
                : "00:00"
            }
          />
          <DateBlock label="Ends" date={form.range.to} sub="23:59" />
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Calendar
            mode="range"
            selected={form.range}
            onSelect={setRange}
            numberOfMonths={overdueRange ? 2 : 1}
            defaultMonth={overdueRange?.from ?? form.range.from ?? today0}
            disabled={isMonthly}
            modifiers={overdueRange ? { overdue: overdueRange } : undefined}
            modifiersClassNames={{
              overdue:
                "relative text-destructive font-semibold after:absolute after:inset-x-1.5 after:bottom-1 after:h-0.5 after:rounded-full after:bg-destructive/70",
            }}
            className="w-full"
          />
        </div>
        {overdueRange && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-semibold text-destructive">
              <span className="size-1.5 rounded-full bg-destructive" />
              Overdue
            </span>
            <span>
              {format(overdueRange.from, "d MMM")} –{" "}
              {format(overdueRange.to, "d MMM yyyy")} ·{" "}
              {vehicle.compliance.kind === "overdue"
                ? vehicle.compliance.daysOverdue
                : 0}{" "}
              days past last licence expiry. Penalty accrues until paid.
            </span>
          </div>
        )}
      </Card>

      <Footer
        backLabel="Back to vehicle"
        continueLabel="Continue to payment"
        onBack={onBack}
        onContinue={onContinue}
        disabled={!isChargeStepValid(form)}
      />
    </>
  )
}

function ChargeOptionCard({
  option,
  selected,
  onSelect,
}: {
  option: ChargeOption
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={option.disabled ? undefined : onSelect}
      disabled={option.disabled}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        option.disabled
          ? "border-dashed border-border/60 bg-muted/30 opacity-60"
          : selected
            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
            : "border-border bg-card hover:border-primary/30"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary" : "border-muted-foreground/30"
        )}
      >
        {selected && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {option.title}
          </span>
          {option.recommended && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold tracking-wide text-secondary-foreground uppercase">
              Recommended
            </span>
          )}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {option.subtitle}
        </span>
        {option.disabled && option.disabledReason && (
          <span className="mt-1 text-[11px] text-muted-foreground/70">
            {option.disabledReason}
          </span>
        )}
      </span>
    </button>
  )
}

function DateBlock({
  label,
  date,
  sub,
}: {
  label: string
  date: Date | undefined
  sub: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-foreground">
        {date ? format(date, "EEE, d MMM yyyy") : "—"}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  )
}

// ── Step: Payment ───────────────────────────────────────────────────────────
function PaymentStep({
  form,
  setForm,
  onBack,
  onSubmit,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onBack: () => void
  onSubmit: () => Promise<void> | void
}) {
  const total = orderTotal(form)
  const walletShort = total > WALLET_BALANCE_MZN
  const channelLocked = form.channel === "wallet" && walletShort
  const failure = form.result?.kind === "failure" ? form.result : null

  const handleSubmit = () => {
    if (channelLocked) return
    void onSubmit()
  }

  return (
    <>
      {failure && (
        <PaymentFailureCard
          reason={failure.reason}
          onRetry={() => onSubmit()}
          onChangeMethod={() =>
            setForm((f) => ({
              ...f,
              channel: f.channel === "mobile" ? "card" : "mobile",
              result: null,
            }))
          }
        />
      )}

      <Card>
        <SectionHeader
          eyebrow="Payment method"
          description="A QR-verifiable digital receipt is issued on every successful payment."
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PAYMENT_CHANNELS.map((channel) => {
            const Icon = channel.icon
            const selected = form.channel === channel.key
            const disabled = channel.key === "wallet" && walletShort
            return (
              <button
                key={channel.key}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => setForm((f) => ({ ...f, channel: channel.key }))}
                className={cn(
                  "group flex items-start gap-3 rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  disabled
                    ? "border-dashed border-border/60 bg-muted/30 opacity-60"
                    : selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border bg-card hover:border-primary/30"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {channel.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {channel.subtitle}
                  </p>
                  {disabled && (
                    <p className="mt-1 text-[11px] text-secondary">
                      Wallet balance is {formatMzn(WALLET_BALANCE_MZN)} MZN —
                      short by {formatMzn(total - WALLET_BALANCE_MZN)} MZN.
                    </p>
                  )}
                </div>
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-primary" : "border-muted-foreground/30"
                  )}
                >
                  {selected && (
                    <span className="size-2 rounded-full bg-primary" />
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {form.channel === "mobile" && (
          <Field>
            <FieldLabel htmlFor="msisdn">Mobile money number</FieldLabel>
            <Input
              id="msisdn"
              inputMode="tel"
              placeholder="+258 84 000 0000"
              defaultValue="+258 84 312 9920"
              className="font-mono tracking-wide"
            />
            <FieldDescription>
              We'll send a USSD prompt to authorise the {formatMzn(total)} MZN
              debit.
            </FieldDescription>
          </Field>
        )}
        {form.channel === "card" && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
            <Field>
              <FieldLabel htmlFor="card-number">Card number</FieldLabel>
              <Input
                id="card-number"
                placeholder="0000 0000 0000 0000"
                className="font-mono"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="card-exp">Expires</FieldLabel>
              <Input id="card-exp" placeholder="MM/YY" className="font-mono" />
            </Field>
            <Field>
              <FieldLabel htmlFor="card-cvc">CVC</FieldLabel>
              <Input id="card-cvc" placeholder="123" className="font-mono" />
            </Field>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onBack}
          className="rounded-lg"
        >
          <ArrowLeft />
          Back to invoice
        </Button>
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={channelLocked}
          className="rounded-lg bg-primary"
        >
          <ShieldCheck />
          {failure
            ? `Retry payment · ${formatMzn(total)} MZN`
            : `Pay ${formatMzn(total)} MZN`}
        </Button>
      </div>
    </>
  )
}

function PaymentFailureCard({
  reason,
  onRetry,
  onChangeMethod,
}: {
  reason: string
  onRetry: () => Promise<void> | void
  onChangeMethod: () => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/15 text-destructive">
        <XCircle className="size-4" />
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">Payment failed</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {reason}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-md"
            onClick={() => void onRetry()}
          >
            <RefreshCcw className="size-3.5" />
            Retry
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-md"
            onClick={onChangeMethod}
          >
            Choose different method
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Right rail ──────────────────────────────────────────────────────────────
function OrderSummary({
  form,
  step,
  onPrimary,
  primaryDisabled,
}: {
  form: FormState
  step: StepKey
  onPrimary: () => void
  primaryDisabled: boolean
}) {
  const subtotal = orderSubtotal(form)
  const adjustment = capAdjustment(form)
  const penalty = orderPenalty(form)
  const total = orderTotal(form)
  const opt = activeOption(form)
  const tier = form.vehicle ? cargoTierForVehicle(form.vehicle) : null

  const primaryLabel =
    step === "vehicle"
      ? "Continue to charge"
      : step === "charge"
        ? "Continue to invoice"
        : step === "invoice"
          ? "Continue to payment"
          : `Pay ${formatMzn(total)} MZN`

  return (
    <section className="relative overflow-hidden rounded-xl bg-sidebar p-5 text-sidebar-foreground">
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 h-12 w-24 rounded-tl-xl border-r-2 border-b-2 border-secondary"
      />
      <p className="text-[10px] font-semibold tracking-widest text-secondary uppercase">
        Order summary
      </p>

      <div className="mt-3 space-y-2 border-b border-sidebar-border/40 pb-3 text-xs">
        <SummaryLine label="Vehicle" value={form.vehicle?.plate ?? "—"} mono />
        <SummaryLine
          label="Category"
          value={
            opt?.kind === "cargo" && tier
              ? `Cargo · ${tier.label}`
              : (opt?.title ?? "—")
          }
        />
        <SummaryLine
          label={opt?.kind === "special" ? "Monthly rate" : "Daily rate"}
          value={
            opt?.kind === "special"
              ? `${formatMzn(opt.monthlyMzn ?? 0)} MZN`
              : opt?.dailyMzn
                ? `${formatMzn(opt.dailyMzn)} MZN`
                : "—"
          }
        />
        {opt?.kind !== "special" && (
          <SummaryLine label="Days" value={`${form.durationDays}`} />
        )}
      </div>

      <div className="mt-3 space-y-2 border-b border-sidebar-border/40 pb-3 text-xs">
        <SummaryLine
          label="Subtotal"
          value={`${subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <SummaryLine label="Service fee" value="0.00" />
        {adjustment > 0 && (
          <SummaryLine
            label="Cap adjustment"
            value={`-${adjustment.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            tone="amber"
          />
        )}
        {penalty > 0 && (
          <SummaryLine
            label="Overdue penalty"
            value={`+${penalty.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            tone="rose"
          />
        )}
      </div>

      <div className="mt-4 flex items-end justify-between">
        <p className="text-sm text-sidebar-foreground/80">Total</p>
        <p className="text-3xl font-semibold tracking-tight">
          {formatMzn(total)}
          <span className="ml-1 align-baseline text-sm font-medium text-sidebar-foreground/70">
            MZN
          </span>
        </p>
      </div>

      <Button
        size="lg"
        onClick={onPrimary}
        disabled={primaryDisabled}
        className="mt-4 w-full rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90"
      >
        {primaryLabel}
        <ArrowRight />
      </Button>
      <p className="mt-3 text-center text-[11px] text-sidebar-foreground/60">
        Compliant status will be updated immediately after successful payment.
      </p>
    </section>
  )
}

function SummaryLine({
  label,
  value,
  mono,
  tone,
}: {
  label: string
  value: string
  mono?: boolean
  tone?: "amber" | "rose"
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sidebar-foreground/70">{label}</span>
      <span
        className={cn(
          "font-medium tabular-nums",
          mono && "font-mono",
          tone === "amber"
            ? "text-secondary"
            : tone === "rose"
              ? "text-destructive"
              : "text-sidebar-foreground"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function CapApplies() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-secondary/40 bg-accent/60 p-4">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
      <div>
        <p className="text-sm font-semibold text-foreground">Cap applies</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Monthly charges across all categories are capped at{" "}
          {formatMzn(MONTHLY_CAP_MZN)} MZN per UC-004 BR-A3.
        </p>
      </div>
    </div>
  )
}

// ── Shared bits ─────────────────────────────────────────────────────────────
function NoVehicleNotice({ onPick }: { onPick: () => void }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Truck className="size-4" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            Pick a vehicle first
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tariffs depend on the vehicle's MVR weight class. Go back to step 1
            to choose one.
          </p>
        </div>
        <Button size="sm" onClick={onPick} className="rounded-md">
          Choose vehicle
        </Button>
      </div>
    </Card>
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
        "flex flex-col gap-4 rounded-xl border border-border bg-card p-5",
        className
      )}
    >
      {children}
    </section>
  )
}

function SectionHeader({
  eyebrow,
  description,
  trailing,
}: {
  eyebrow: string
  description?: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          {eyebrow}
        </p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {trailing}
    </div>
  )
}

function Footer({
  backLabel,
  continueLabel,
  onBack,
  onContinue,
  disabled,
}: {
  backLabel: string
  continueLabel: string
  onBack: () => void
  onContinue: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <Button
        variant="outline"
        size="lg"
        onClick={onBack}
        className="rounded-lg"
      >
        <ArrowLeft />
        {backLabel}
      </Button>
      <Button
        size="lg"
        onClick={onContinue}
        disabled={disabled}
        className="rounded-lg"
      >
        {continueLabel}
        <ArrowRight />
      </Button>
    </div>
  )
}

// ── Step: Invoice ───────────────────────────────────────────────────────────
function InvoiceStep({
  form,
  onBack,
  onContinue,
}: {
  form: FormState
  onBack: () => void
  onContinue: () => void
}) {
  const vehicle = form.vehicle!
  const opt = activeOption(form)
  const subtotal = orderSubtotal(form)
  const adjustment = capAdjustment(form)
  const penalty = orderPenalty(form)
  const total = orderTotal(form)
  const tier = cargoTierForVehicle(vehicle)
  const isMonthly = opt?.kind === "special"
  const isOverdue = vehicle.compliance.kind === "overdue"
  const duplicateMonth = vehicle.lastPaidPeriod === CURRENT_PERIOD
  const vl11 = hasOpenPostpaidBalance(vehicle)

  return (
    <>
      {vl11 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Settle the open postpaid balance first (VL-11)
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {vehicle.plate} has an unsettled postpaid accrual. Per VL-11, a
              new licence cannot be issued until the existing balance is paid
              down to zero. The penalty below is the accrued amount carried
              forward.
            </p>
          </div>
        </div>
      )}

      {duplicateMonth && (
        <div className="flex items-start gap-3 rounded-xl border border-secondary/40 bg-accent/60 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-secondary" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Already paid for {format(today0, "MMMM yyyy")}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              An active Circulation Licence covers {vehicle.plate} for this
              period (BR-004-07). Continuing will create a duplicate transaction
              — confirm the operator's intent before proceeding.
            </p>
          </div>
        </div>
      )}

      {isOverdue && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Overdue penalty applies
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Last licence expired{" "}
              {vehicle.compliance.kind === "overdue"
                ? vehicle.compliance.expDate
                : "—"}{" "}
              ·{" "}
              {vehicle.compliance.kind === "overdue"
                ? vehicle.compliance.daysOverdue
                : 0}{" "}
              days overdue at{" "}
              {formatMzn(
                vehicle.compliance.kind === "overdue"
                  ? vehicle.compliance.penaltyDailyMzn
                  : 0
              )}{" "}
              MZN/day.
            </p>
          </div>
        </div>
      )}

      <InvoiceDocument
        vehicle={vehicle}
        form={form}
        subtotal={subtotal}
        adjustment={adjustment}
        penalty={penalty}
        total={total}
        tier={tier}
        isMonthly={isMonthly}
      />

      <Footer
        backLabel="Back to charge"
        continueLabel="Continue to payment"
        onBack={onBack}
        onContinue={onContinue}
      />
    </>
  )
}

function InvoiceDocument({
  vehicle,
  form,
  subtotal,
  adjustment,
  penalty,
  total,
  tier,
  isMonthly,
}: {
  vehicle: Vehicle
  form: FormState
  subtotal: number
  adjustment: number
  penalty: number
  total: number
  tier: { label: string; mznPerDay: number }
  isMonthly: boolean
}) {
  const due = PAYMENT_DEADLINE
  const fromDate = form.range.from ?? today0
  const toDate = form.range.to ?? form.range.from ?? today0
  const overdueDays =
    vehicle.compliance.kind === "overdue" ? vehicle.compliance.daysOverdue : 0
  const overduePenaltyDaily =
    vehicle.compliance.kind === "overdue"
      ? vehicle.compliance.penaltyDailyMzn
      : 0

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Letterhead */}
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border bg-sidebar p-6 text-sidebar-foreground">
        <div className="flex items-start gap-3">
          <img
            src="/maputo-logo.webp"
            alt="Município de Maputo"
            className="size-14 shrink-0 rounded-lg bg-card object-contain p-1"
          />
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-secondary uppercase">
              República de Moçambique
            </p>
            <p className="mt-0.5 text-base leading-tight font-semibold">
              Conselho Municipal de Maputo
            </p>
            <p className="text-[11px] leading-snug text-sidebar-foreground/70">
              Direcção dos Transportes e Trânsito
              <br />
              Praça da Independência, Maputo · NUIT 400 412 985
            </p>
          </div>
        </div>
      </header>

      {/* Bill to / Invoice details */}
      <section className="grid grid-cols-1 gap-6 border-b border-border p-6 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            Bill to
          </p>
          <p className="mt-1.5 text-sm font-semibold text-foreground">
            Operator of {vehicle.plate}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Logbook ref. <span className="font-mono">{vehicle.logbookRef}</span>
            <br />
            VIN <span className="font-mono">{vehicle.chassisVin}</span>
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
          <InvoiceMeta
            label="Vehicle"
            value={`${vehicle.plate} · ${vehicle.model}`}
            mono
          />
          <InvoiceMeta
            label="Class"
            value={`${tier.label} (${formatMzn(vehicle.weightKg)} kg)`}
          />
          <InvoiceMeta label="Charge category" value={categoryLabel(form)} />
          <InvoiceMeta
            label={isMonthly ? "Period" : "Coverage"}
            value={`${format(fromDate, "d MMM")} – ${format(toDate, "d MMM yyyy")}`}
          />
          {!isMonthly && (
            <InvoiceMeta
              label="Days"
              value={`${form.durationDays} ${form.durationDays === 1 ? "day" : "days"}`}
            />
          )}
          <InvoiceMeta
            label="Payment deadline"
            value={format(due, "EEE, d MMM yyyy")}
          />
        </dl>
      </section>

      {/* Line-items table */}
      <section className="px-6 pt-5">
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-left">
                <th className="px-4 py-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Description
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Qty
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Unit price
                </th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">
                    {categoryLabel(form)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isMonthly
                      ? "Monthly Special Circulation Licence — covers all categories within the cap."
                      : `Daily tariff resolved from Annex I (FE-04) for the ${tier.label} weight band.`}
                  </p>
                </td>
                <td className="px-3 py-3 text-right text-foreground tabular-nums">
                  {isMonthly ? "1 mo" : `${form.durationDays} d`}
                </td>
                <td className="px-3 py-3 text-right text-foreground tabular-nums">
                  {isMonthly
                    ? `${formatMzn(subtotal)} MZN`
                    : `${formatMzn(tier.mznPerDay)} MZN`}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                  {formatMzn(subtotal)} MZN
                </td>
              </tr>
              {adjustment > 0 && (
                <tr>
                  <td className="px-4 py-3">
                    <p className="font-medium text-secondary">
                      Monthly cap adjustment
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      BR-004-05 — total monthly charges across categories cannot
                      exceed {formatMzn(MONTHLY_CAP_MZN)} MZN.
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                    —
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                    —
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-secondary tabular-nums">
                    −{formatMzn(adjustment)} MZN
                  </td>
                </tr>
              )}
              {penalty > 0 && (
                <tr>
                  <td className="px-4 py-3">
                    <p className="font-medium text-destructive">
                      Overdue penalty
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Daily accrual on the prior unsettled licence period
                      (TX-05).
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right text-foreground tabular-nums">
                    {overdueDays} d
                  </td>
                  <td className="px-3 py-3 text-right text-foreground tabular-nums">
                    {formatMzn(overduePenaltyDaily)} MZN
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-destructive tabular-nums">
                    +{formatMzn(penalty)} MZN
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Totals */}
      <section className="flex justify-end px-6 py-5">
        <dl className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="text-foreground tabular-nums">
              {formatMzn(subtotal)} MZN
            </dd>
          </div>
          {adjustment > 0 && (
            <div className="flex items-center justify-between text-secondary">
              <dt>Cap adjustment</dt>
              <dd className="tabular-nums">−{formatMzn(adjustment)} MZN</dd>
            </div>
          )}
          {penalty > 0 && (
            <div className="flex items-center justify-between text-destructive">
              <dt>Overdue penalty</dt>
              <dd className="tabular-nums">+{formatMzn(penalty)} MZN</dd>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-2">
            <dt className="text-xs text-muted-foreground">VAT</dt>
            <dd className="text-xs text-muted-foreground tabular-nums">
              Included
            </dd>
          </div>
          <div className="flex items-center justify-between border-t-2 border-foreground pt-2">
            <dt className="text-base font-semibold text-foreground">
              Total payable
            </dt>
            <dd className="text-base font-semibold text-foreground tabular-nums">
              {formatMzn(total)} MZN
            </dd>
          </div>
        </dl>
      </section>

      {/* Footer / payment terms */}
      <footer className="border-t border-dashed border-border bg-muted/30 px-6 py-4 text-[11px] leading-snug text-muted-foreground">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-foreground">Payment terms</p>
            <p className="mt-1">
              Settle by{" "}
              <span className="font-semibold text-foreground">
                {format(due, "d MMM yyyy")}
              </span>
              . A QR-verifiable digital receipt is issued on confirmation. Late
              payments accrue {formatMzn(overduePenaltyDaily || 200)} MZN/day.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">References</p>
            <p className="mt-1 font-mono text-[10px] tracking-wider">
              VC-01 · FE-04 · BR-004-05 · TX-01
            </p>
            <p className="mt-1">
              This is a <span className="font-semibold">proforma invoice</span>{" "}
              for review only. No transaction posted yet.
            </p>
          </div>
        </div>
      </footer>
    </article>
  )
}

function InvoiceMeta({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "text-xs text-foreground",
          mono && "font-mono tracking-wider"
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function InvoiceLine({
  label,
  value,
  tone,
  emphasised,
}: {
  label: string
  value: string
  tone?: "amber" | "rose"
  emphasised?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 text-sm not-last:border-b not-last:border-border/60",
        emphasised && "bg-card font-semibold"
      )}
    >
      <span
        className={cn("text-muted-foreground", emphasised && "text-foreground")}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-medium tabular-nums",
          tone === "amber"
            ? "text-secondary"
            : tone === "rose"
              ? "text-destructive"
              : "text-foreground",
          emphasised && "text-base"
        )}
      >
        {value}
      </span>
    </div>
  )
}

// ── Step: Processing ────────────────────────────────────────────────────────
function ProcessingStep({ form }: { form: FormState }) {
  const channel = PAYMENT_CHANNELS.find((c) => c.key === form.channel)
  const Icon = channel?.icon ?? ShieldCheck
  return (
    <Card className="items-center text-center">
      <div className="flex flex-col items-center gap-4 py-8">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" />
        </span>
        <Spinner className="size-5 text-primary" />
        <div>
          <p className="text-base font-semibold text-foreground">
            Authorising via {channel?.title ?? form.channel}…
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {form.channel === "mobile" &&
              "We've sent a USSD prompt to the operator's handset. Approve to confirm."}
            {form.channel === "card" &&
              "Routing to the issuer for 3-D Secure step-up. Don't refresh."}
            {form.channel === "wallet" &&
              "Debiting your wallet balance. This usually takes a moment."}
          </p>
        </div>
      </div>
    </Card>
  )
}

// ── Step: Receipt ───────────────────────────────────────────────────────────
function ReceiptStep({
  result,
  onPayAnother,
  onViewTransactions,
}: {
  result: PaymentResult
  onPayAnother: () => void
  onViewTransactions: () => void
}) {
  if (result.kind === "failure") return null
  const receipt = result.receipt
  const isPending = result.kind === "pending"
  const validUntil = format(new Date(receipt.rangeToIso), "dd.MM.yyyy")
  const receiptSerial = receipt.number.replace(/\D/g, "").slice(-7) || "0000000"
  const receiptYear = format(new Date(receipt.issuedAt), "yyyy")
  const receiptSeries = receipt.category.toLowerCase().includes("special")
    ? "S"
    : "B"

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border p-4",
          isPending
            ? "border-secondary/40 bg-accent/60"
            : "border-primary/30 bg-primary/5"
        )}
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            isPending
              ? "bg-secondary/20 text-secondary"
              : "bg-primary text-primary-foreground"
          )}
        >
          {isPending ? (
            <AlertTriangle className="size-5" />
          ) : (
            <BadgeCheck className="size-5" />
          )}
        </span>
        <div className="flex-1">
          <p className="text-base font-semibold text-foreground">
            {isPending
              ? "Payment instructed · awaiting bank"
              : "Payment confirmed"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isPending
              ? `Wire ${formatMzn(receipt.totalMzn)} MZN to settle. Receipt will finalise after T+1 reconciliation.`
              : `${formatMzn(receipt.totalMzn)} MZN charged to ${receipt.channelLabel}. Receipt ${receipt.number} issued.`}
          </p>
        </div>
        <StatusPill tone={isPending ? "warning" : "compliant"}>
          {isPending ? "Pending bank" : "Paid"}
        </StatusPill>
      </div>

      <Card>
        <SectionHeader
          eyebrow="Digital receipt"
          description="Vehicle tax sticker view for roadside checkpoint verification."
        />

        <div className="mx-auto w-full max-w-xl rounded-[28px] border border-primary/20 bg-primary/10 p-4 shadow-sm">
          <div className="relative overflow-hidden rounded-[22px] border border-primary/30 bg-card p-5">
            <img
              src="/maputo-logo.webp"
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 m-auto h-[88%] w-[88%] object-contain opacity-[0.045]"
            />
            <div className="pointer-events-none absolute inset-3 rounded-full border-2 border-primary/45" />
            <div className="pointer-events-none absolute inset-8 rounded-full border border-secondary/50" />

            <div className="relative flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Município de Maputo
                </p>
                <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                  Vehicle tax receipt
                </p>
              </div>
              <img
                src="/maputo-logo.webp"
                alt="Município de Maputo"
                className="size-12 shrink-0 object-contain"
              />
            </div>

            <div className="relative mt-5 grid grid-cols-[132px_1fr] items-center gap-4">
              <div className="rounded-md bg-card/90 p-2 shadow-xs">
                <QrPlaceholder payload={receipt.qrPayload} compact />
              </div>
              <div className="min-w-0">
                <p className="truncate font-mono text-2xl font-semibold tracking-wider text-foreground">
                  {receipt.vehiclePlate.replace(/\s+/g, "")}
                </p>
                <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
                  {receipt.vehicleModel}
                </p>
                <p className="mt-3 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Category
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">
                  {receipt.category}
                </p>
              </div>
            </div>

            <div className="relative mt-5 grid grid-cols-3 overflow-hidden rounded-lg border border-border bg-background/85 text-center">
              <StickerField label="Serial" value={receiptSerial} mono />
              <StickerField label="Year" value={receiptYear} mono />
              <StickerField label="Series" value={receiptSeries} mono />
            </div>

            <div className="relative mt-4 flex items-center justify-between gap-4 rounded-lg border border-border bg-background/85 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Valid until
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold tracking-wider text-foreground">
                  {validUntil}
                </p>
                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                  Receipt {receipt.number} · {receipt.channelLabel}
                </p>
              </div>
              <span
                aria-hidden
                className="size-12 shrink-0 rounded-full border border-secondary/70 bg-[conic-gradient(from_20deg,hsl(var(--secondary)),hsl(var(--primary)),hsl(var(--accent)),hsl(var(--secondary)))] opacity-80 shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30">
          <InvoiceLine
            label="Subtotal"
            value={`${formatMzn(receipt.subtotalMzn)} MZN`}
          />
          {receipt.capAdjustmentMzn > 0 && (
            <InvoiceLine
              label="Monthly cap adjustment"
              value={`-${formatMzn(receipt.capAdjustmentMzn)} MZN`}
              tone="amber"
            />
          )}
          {receipt.penaltyMzn > 0 && (
            <InvoiceLine
              label="Overdue penalty"
              value={`+${formatMzn(receipt.penaltyMzn)} MZN`}
              tone="rose"
            />
          )}
          <InvoiceLine
            label="Total"
            value={`${formatMzn(receipt.totalMzn)} MZN`}
            emphasised
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="rounded-md"
            onClick={() =>
              toast.success("SMS receipt sent", {
                description: `Receipt ${receipt.number} sent to +258 84 312 9920.`,
              })
            }
          >
            <MessageSquare className="size-3.5" />
            Send by SMS
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-md"
            onClick={() =>
              toast.success("Email receipt sent", {
                description: `Receipt ${receipt.number} sent to operator email on file.`,
              })
            }
          >
            <Mail className="size-3.5" />
            Send by email
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-md"
            onClick={() => {
              toast.info("Generating PDF…", {
                description:
                  "Use your browser's print dialog to save a PDF copy.",
              })
              window.print()
            }}
          >
            <Download className="size-3.5" />
            Download PDF
          </Button>
        </div>
      </Card>

      {!isPending ? (
        <ComplianceFlip vehiclePlate={receipt.vehiclePlate} />
      ) : (
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary/15 text-secondary">
              <FileText className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Compliance update on hold
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {receipt.vehiclePlate} stays in its current state until the bank
                reconciles the wire (typically T+1). We'll flip the status
                automatically when funds clear.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onPayAnother}
          className="rounded-lg"
        >
          <Plus />
          Pay another charge
        </Button>
        <Button size="lg" onClick={onViewTransactions} className="rounded-lg">
          View transactions
          <ArrowRight />
        </Button>
      </div>
    </>
  )
}

function StickerField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="border-r border-border px-2 py-2 last:border-r-0">
      <p className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold text-foreground",
          mono && "font-mono tracking-wider"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function ComplianceFlip({ vehiclePlate }: { vehiclePlate: string }) {
  const [updated, setUpdated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setUpdated(true), 900)
    return () => clearTimeout(t)
  }, [])
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            updated
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {updated ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Spinner className="size-4" />
          )}
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            {updated ? "Compliance updated" : "Updating compliance…"}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {updated
              ? `${vehiclePlate} is now Compliant in the enforcement feed. Roadside officers see the update in real time (BR-007-05).`
              : "Pushing the new licence to the enforcement feed. Status will flip once acknowledged."}
          </p>
        </div>
        {updated && <StatusPill tone="compliant">Compliant</StatusPill>}
      </div>
    </Card>
  )
}

function QrPlaceholder({
  payload,
  compact = false,
}: {
  payload: string
  compact?: boolean
}) {
  return (
    <div
      role="img"
      aria-label={`Compliance QR for ${payload}`}
      className={cn(
        "flex shrink-0 flex-col items-center justify-center gap-1 border-2 border-dashed border-border bg-muted/40 text-muted-foreground",
        compact ? "h-28 w-28 rounded-md" : "h-32 w-32 rounded-lg"
      )}
    >
      <QrCode className={compact ? "size-20" : "size-10"} strokeWidth={1.5} />
      <span className="px-2 text-center font-mono text-[9px] leading-tight break-all text-muted-foreground/80">
        {compact ? "SCAN" : payload}
      </span>
    </div>
  )
}

// ── Step: Route (path B) ────────────────────────────────────────────────────
type RouteFilter = "all" | "DESIGNATED" | "PORT_CORRIDOR"

function RouteStep({
  form,
  setForm,
  onBack,
  onContinue,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onBack: () => void
  onContinue: () => void
}) {
  const designated = useMemo(() => getDesignatedRoutes(), [])
  const portCorridor = useMemo(() => getPortCorridorRoutes(), [])
  const allRoutes = useMemo(
    () => [...designated, ...portCorridor],
    [designated, portCorridor]
  )
  const selected = form.routeCode ? (lookupRoute(form.routeCode) ?? null) : null
  const isOffList = isOffListRoute(selected)

  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<RouteFilter>("all")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allRoutes.filter((r) => {
      if (filter !== "all" && r.routeCategory !== filter) return false
      if (!q) return true
      return (
        r.routeName.toLowerCase().includes(q) ||
        r.routeCode.toLowerCase().includes(q)
      )
    })
  }, [allRoutes, query, filter])

  const setRouteCode = (code: string) => {
    setForm((f) => ({ ...f, routeCode: code }))
  }

  return (
    <>
      <Card>
        <SectionHeader
          eyebrow="Route"
          description={`Designated avenues unlock NIGHT_RESTRICTED (${NIGHT_WINDOW_LABEL}); port-corridor segments are fee-exempt; off-list routes go to EXCEPTIONAL with escort.`}
          trailing={
            selected && !isOffList ? (
              <span className="inline-flex max-w-[200px] items-center gap-1.5 truncate rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                <RouteIcon className="size-3 shrink-0" />
                <span className="truncate">{selected.routeName}</span>
              </span>
            ) : undefined
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search avenue or code…"
              className="h-9 rounded-lg pl-8 text-sm"
            />
          </div>
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            count={allRoutes.length}
          >
            All
          </FilterChip>
          <FilterChip
            active={filter === "DESIGNATED"}
            onClick={() => setFilter("DESIGNATED")}
            count={designated.length}
            icon={<Moon className="size-3" />}
          >
            Designated
          </FilterChip>
          <FilterChip
            active={filter === "PORT_CORRIDOR"}
            onClick={() => setFilter("PORT_CORRIDOR")}
            count={portCorridor.length}
            icon={<Anchor className="size-3" />}
          >
            Port corridor
          </FilterChip>
        </div>

        <button
          type="button"
          onClick={() => setRouteCode(OFF_LIST_ROUTE.routeCode)}
          className={cn(
            "flex items-center gap-3 rounded-lg border-2 border-dashed px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            isOffList
              ? "border-destructive/50 bg-destructive/5"
              : "border-border bg-muted/20 hover:border-destructive/40 hover:bg-destructive/5"
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <MapIcon className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              Off-list route
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              Exceptional workflow: livrete + title + justification + police
              escort.
            </p>
          </div>
          <span
            aria-hidden
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border",
              isOffList ? "border-destructive" : "border-muted-foreground/30"
            )}
          >
            {isOffList && (
              <span className="size-2 rounded-full bg-destructive" />
            )}
          </span>
        </button>

        <ul className="max-h-[360px] divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-xs text-muted-foreground">
              No routes match "{query}".
            </li>
          ) : (
            filtered.map((r) => {
              const isSelected = form.routeCode === r.routeCode
              const isPort = r.routeCategory === "PORT_CORRIDOR"
              return (
                <li key={r.routeCode}>
                  <button
                    type="button"
                    onClick={() => setRouteCode(r.routeCode)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      isSelected ? "bg-primary/5" : "hover:bg-muted/40"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        isSelected
                          ? "border-primary"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {isSelected && (
                        <span className="size-2 rounded-full bg-primary" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "inline-flex size-5 shrink-0 items-center justify-center rounded text-[10px]",
                        isPort
                          ? "bg-primary/10 text-primary"
                          : "bg-secondary/15 text-secondary"
                      )}
                    >
                      {isPort ? (
                        <Anchor className="size-3" />
                      ) : (
                        <Moon className="size-3" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {r.routeName}
                    </span>
                    {r.note && (
                      <span className="hidden truncate text-[11px] text-muted-foreground sm:inline-block">
                        {r.note}
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-[10px] tracking-wider text-muted-foreground/70">
                      {r.routeCode}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </Card>

      <Footer
        backLabel="Back to vehicle"
        continueLabel="Continue to window"
        onBack={onBack}
        onContinue={onContinue}
        disabled={!selected}
      />
    </>
  )
}

function FilterChip({
  active,
  onClick,
  count,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  count: number
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5"
      )}
    >
      {icon}
      {children}
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] tabular-nums",
          active
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  )
}

// ── Step: Operating window (path B) ─────────────────────────────────────────
const WINDOW_PRESETS = [1, 3, 7, 14, 30] as const

function WindowStep({
  form,
  setForm,
  decision,
  onBack,
  onContinue,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  decision: AccessDecision
  onBack: () => void
  onContinue: () => void
}) {
  const setDays = (days: number) => {
    setForm((f) => {
      const from = f.range.from ?? today0
      return {
        ...f,
        durationDays: days,
        range: { from, to: addDays(from, Math.max(0, days - 1)) },
      }
    })
  }
  const setRange = (range: DateRange | undefined) => {
    if (!range?.from) return
    const from = range.from
    const to = range.to ?? from
    const days = differenceInCalendarDays(to, from) + 1
    setForm((f) => ({ ...f, range: { from, to }, durationDays: days }))
  }
  const isLockedNight = decision.licenceType === "NIGHT_RESTRICTED"
  const days = form.durationDays
  const valid = !!form.range.from && !!form.range.to && days > 0

  return (
    <>
      <Card>
        <SectionHeader
          eyebrow="Operating window"
          description={
            isLockedNight
              ? `Time window is locked to ${NIGHT_WINDOW_LABEL} per TW-02. Pick the date range you'll be operating across.`
              : decision.licenceType === "PORT_EXEMPT"
                ? "Port corridor has no time restriction (TW-03). Pick the dates you'll be transiting."
                : "Exceptional authorisation overrides time windows (TW-04). Pick the operating range."
          }
          trailing={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <Clock className="size-3" />
              {days} {days === 1 ? "day" : "days"}
            </span>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            Quick presets
          </span>
          {WINDOW_PRESETS.map((d) => {
            const active = days === d
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5"
                )}
              >
                {d} {d === 1 ? "day" : "days"}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DateBlock
            label="Starts"
            date={form.range.from}
            sub={isLockedNight ? "20:00 (TW-02 locked)" : "00:00"}
          />
          <DateBlock
            label="Ends"
            date={form.range.to}
            sub={isLockedNight ? "06:00 (TW-02 locked)" : "23:59"}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-muted/20 p-2">
          <Calendar
            mode="range"
            selected={form.range}
            onSelect={setRange}
            numberOfMonths={1}
            defaultMonth={form.range.from ?? today0}
            className="w-full bg-transparent"
          />
        </div>

        {isLockedNight && (
          <div className="flex items-start gap-2 rounded-lg border border-secondary/30 bg-accent/40 px-3 py-2.5 text-[11px] leading-snug text-muted-foreground">
            <Moon className="mt-0.5 size-3.5 shrink-0 text-secondary" />
            <p>
              Operation is permitted only during the night window each day in
              the selected range ({NIGHT_WINDOW_LABEL}). Movement outside that
              window raises an OUT_OF_HOURS_MOVEMENT violation.
            </p>
          </div>
        )}
      </Card>

      <Footer
        backLabel="Back to route"
        continueLabel={
          decision.licenceType === "EXCEPTIONAL"
            ? "Continue to attachments"
            : "Continue to review"
        }
        onBack={onBack}
        onContinue={onContinue}
        disabled={!valid}
      />
    </>
  )
}

// ── Step: Attachments (EXCEPTIONAL only) ────────────────────────────────────
function AttachmentsStep({
  form,
  setForm,
  onBack,
  onContinue,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onBack: () => void
  onContinue: () => void
}) {
  const vehicle = form.vehicle!
  const a = form.attachments
  const setAttachment = (patch: Partial<Attachments>) =>
    setForm((f) => ({ ...f, attachments: { ...f.attachments, ...patch } }))

  const errors = validateApplication({
    vehicle,
    route: form.routeCode ? (lookupRoute(form.routeCode) ?? null) : null,
    licenceType: "EXCEPTIONAL",
    durationDays: form.durationDays,
    attachments: form.attachments,
    deviceActive: true,
    hasOpenPostpaidBalance: hasOpenPostpaidBalance(vehicle),
  })
  const blocking = errors.filter((e) => e.code === "VL-03")

  return (
    <>
      <Card>
        <SectionHeader
          eyebrow="Mandatory attachments (AU-01 · VL-03)"
          description="The directorate cannot review an exceptional authorisation without these four artefacts."
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FileSlot
            label="Vehicle Registration (Livrete)"
            filename={a.livreteFilename}
            onPick={(name) => setAttachment({ livreteFilename: name })}
          />
          <FileSlot
            label="Title of Ownership"
            filename={a.titleFilename}
            onPick={(name) => setAttachment({ titleFilename: name })}
          />
          <FileSlot
            label="Police Escort Request"
            filename={
              a.escortRequestRef ? `Reference ${a.escortRequestRef}` : undefined
            }
            onPick={() =>
              setAttachment({
                escortRequestRef: `MP-ESC-${Math.floor(10_000 + Math.random() * 80_000)}`,
              })
            }
          />
          <Field className="md:col-span-1">
            <FieldLabel htmlFor="justification">
              Justification (≥ 20 chars)
            </FieldLabel>
            <Textarea
              id="justification"
              rows={3}
              value={a.justification ?? ""}
              onChange={(e) => setAttachment({ justification: e.target.value })}
              placeholder="Cite the extreme necessity that warrants off-route operation…"
            />
            <FieldDescription>
              Per AU-01 the justification must explicitly cite "extreme
              necessity".
            </FieldDescription>
          </Field>
        </div>

        {blocking.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-[11px] font-semibold text-destructive">
              Outstanding (VL-03):
            </p>
            <ul className="mt-1 list-disc pl-5 text-[11px] leading-snug text-muted-foreground">
              {blocking.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Footer
        backLabel="Back to route"
        continueLabel="Continue to review"
        onBack={onBack}
        onContinue={onContinue}
        disabled={blocking.length > 0}
      />
    </>
  )
}

function FileSlot({
  label,
  filename,
  onPick,
}: {
  label: string
  filename?: string
  onPick: (name: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(`${label.toLowerCase().replace(/\s+/g, "-")}.pdf`)}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        filename
          ? "border-primary/40 bg-primary/5"
          : "border-dashed border-border bg-muted/20 hover:border-primary/30"
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          filename
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Paperclip className="size-4" />
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {filename ?? "Click to attach (demo placeholder)"}
        </p>
      </div>
      {filename && <CheckCircle2 className="size-4 text-primary" />}
    </button>
  )
}

// ── Step: Review & submit (path B) ──────────────────────────────────────────
function ReviewSubmitStep({
  form,
  decision,
  route,
  onBack,
  onSubmit,
}: {
  form: FormState
  decision: AccessDecision
  route: Route
  onBack: () => void
  onSubmit: () => Promise<void> | void
}) {
  const vehicle = form.vehicle!
  const fee = resolveFee({
    vehicle,
    licenceType: decision.licenceType,
    durationDays: form.durationDays,
  })
  const errors = validateApplication({
    vehicle,
    route,
    licenceType: decision.licenceType,
    durationDays: form.durationDays,
    attachments: form.attachments,
    deviceActive: true,
    hasOpenPostpaidBalance: hasOpenPostpaidBalance(vehicle),
  })
  const blocked = errors.length > 0
  const coverage =
    form.range.from && form.range.to
      ? `${format(form.range.from, "d MMM")} - ${format(form.range.to, "d MMM yyyy")}`
      : "-"
  const feeLabel = decision.feeExempt
    ? "Fee-exempt - audit only"
    : `${formatMzn(fee.totalMzn)} MZN`
  const attachmentSummary =
    decision.licenceType === "EXCEPTIONAL"
      ? [
          ["Livrete", form.attachments.livreteFilename ?? "-"],
          ["Title of ownership", form.attachments.titleFilename ?? "-"],
          ["Justification", form.attachments.justification ? "Provided" : "-"],
          ["Police escort ref", form.attachments.escortRequestRef ?? "-"],
        ]
      : [["Attachments", "Not required for this licence type"]]

  return (
    <>
      <section className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <img
          src="/maputo-logo.webp"
          alt=""
          aria-hidden
          className="pointer-events-none absolute top-44 left-1/2 h-[460px] w-[560px] max-w-none -translate-x-1/2 opacity-[0.055]"
        />

        <div className="relative border-b border-border px-7 pt-6 pb-5">
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <img
                src="/maputo-logo.webp"
                alt="Município de Maputo"
                className="size-20 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Município de Maputo
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                  Pedido de Autorização de Circulação
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                  Documento de submissão para verificação pela Direcção
                  Municipal. A taxa é pagável quando a licença ficar ACTIVE.
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-lg border border-border bg-muted/30 px-3 py-2 text-right">
              <p className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">
                Estado
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                Draft review
              </p>
            </div>
          </div>
        </div>

        <div className="relative px-7 py-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_220px]">
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Requerente / veículo
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <DocumentField label="Plate" value={vehicle.plate} mono />
                <DocumentField label="Vehicle" value={vehicle.model} />
                <DocumentField
                  label="Logbook"
                  value={vehicle.logbookRef}
                  mono
                />
                <DocumentField
                  label="Gross weight"
                  value={`${formatMzn(vehicle.weightKg)} kg`}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background/80 p-3">
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Fee on activation
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {feeLabel}
              </p>
              {!decision.feeExempt && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {fee.tierLabel} · {form.durationDays} day
                  {form.durationDays === 1 ? "" : "s"}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Licence particulars
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <DocumentField
                label="Licence type"
                value={licenceTypeLabel(decision.licenceType)}
              />
              <DocumentField label="Route" value={route.routeName} />
              <DocumentField
                label="Operating window"
                value={decision.lockedTimeWindow?.label ?? "Per range"}
              />
              <DocumentField label="Coverage" value={coverage} />
              <DocumentField
                label="Police escort"
                value={decision.requiresEscort ? "Required" : "Not required"}
              />
              <DocumentField
                label="Estimated review"
                value={
                  form.application?.estimatedDecisionWindowLabel ??
                  estimatedReviewWindowLabel(decision.licenceType)
                }
              />
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Supporting record
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              {attachmentSummary.map(([label, value]) => (
                <DocumentField key={label} label={label} value={value} />
              ))}
            </div>
          </div>

          {blocked && (
            <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-[11px] font-semibold text-destructive">
                Cannot submit yet:
              </p>
              <ul className="mt-1 list-disc pl-5 text-[11px] leading-snug text-muted-foreground">
                {errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-mono text-[10px] tracking-wider">
                      {e.code}
                    </span>{" "}
                    · {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 rounded-lg border border-border bg-background/80 p-3 text-[11px] leading-snug text-muted-foreground">
            <p className="font-semibold text-foreground">
              {decision.decisionLine}
            </p>
            <p className="mt-1">{decision.rationale}</p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 border-t border-border pt-5 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <p className="font-semibold text-foreground">Prepared by</p>
              <p className="mt-5 border-t border-border pt-2">
                Transporter portal
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Submitted to</p>
              <p className="mt-5 border-t border-border pt-2">
                Direcção Municipal
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Review stamp</p>
              <p className="mt-5 border-t border-border pt-2">
                Pending verification
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onBack}
          className="rounded-lg"
        >
          <ArrowLeft />
          Back
        </Button>
        <Button
          size="lg"
          onClick={() => void onSubmit()}
          disabled={blocked}
          className="rounded-lg bg-primary"
        >
          <FileText />
          Submit for verification
        </Button>
      </div>
    </>
  )
}

function DocumentField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0 border-b border-border pb-2">
      <dt className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 truncate text-sm font-medium text-foreground",
          mono && "font-mono tracking-wider"
        )}
      >
        {value || "-"}
      </dd>
    </div>
  )
}

function licenceTypeLabel(licenceType: LicenceType): string {
  switch (licenceType) {
    case "STANDARD":
      return "Standard circulation"
    case "NIGHT_RESTRICTED":
      return "Night-restricted (designated routes)"
    case "PORT_EXEMPT":
      return "Port corridor (fee-exempt)"
    case "EXCEPTIONAL":
      return "Exceptional (escorted)"
  }
}

function estimatedReviewWindowLabel(licenceType: LicenceType): string {
  switch (licenceType) {
    case "PORT_EXEMPT":
      return "≈ 1 working day"
    case "NIGHT_RESTRICTED":
      return "≈ 3 working days"
    case "EXCEPTIONAL":
      return "5–10 working days"
    case "STANDARD":
      return "Immediate (pay-now)"
  }
}

// ── Step: Submitting ────────────────────────────────────────────────────────
function SubmittingStep() {
  return (
    <Card className="items-center text-center">
      <div className="flex flex-col items-center gap-4 py-8">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileText className="size-6" />
        </span>
        <Spinner className="size-5 text-primary" />
        <div>
          <p className="text-base font-semibold text-foreground">
            Lodging with the Municipal Directorate…
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            We're stamping the application and routing it for review. Don't
            refresh.
          </p>
        </div>
      </div>
    </Card>
  )
}

// ── Step: Submitted (path B terminal) ───────────────────────────────────────
function SubmittedStep({
  application,
  onSubmitAnother,
  onViewApplications,
}: {
  application: LicenceApplication
  onSubmitAnother: () => void
  onViewApplications: () => void
}) {
  const lifecycle = lifecycleFor(application.licenceType)
  const currentIndex = lifecycle.indexOf(application.status)

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <BadgeCheck className="size-5" />
        </span>
        <div className="flex-1">
          <p className="text-base font-semibold text-foreground">
            Application submitted · {application.reference}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {licenceTypeLabel(application.licenceType)} for{" "}
            {application.vehicle.plate} on {application.route.routeName}.
            Estimated review: {application.estimatedDecisionWindowLabel}.
          </p>
        </div>
        <StatusPill tone="renewal-soon">Submitted</StatusPill>
      </div>

      <Card>
        <SectionHeader
          eyebrow="Authorisation workflow (§7)"
          description="Track progress through the directorate and presidential sign-off."
          trailing={
            <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-[11px] tracking-wider text-foreground">
              {application.reference}
            </span>
          }
        />
        <ol className="flex flex-col">
          {lifecycle.map((status, i) => {
            const done = i < currentIndex
            const active = i === currentIndex
            const isLast = i === lifecycle.length - 1
            return (
              <li key={status} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                      done &&
                        "border-primary bg-primary text-primary-foreground",
                      active &&
                        "animate-pulse border-primary bg-card text-primary ring-4 ring-primary/10",
                      !done &&
                        !active &&
                        "border-muted-foreground/20 bg-muted/40 text-muted-foreground/50"
                    )}
                    aria-hidden
                  >
                    {done ? (
                      <CheckCircle2 className="size-3.5" strokeWidth={3} />
                    ) : (
                      <Clock className="size-3.5" />
                    )}
                  </span>
                  {!isLast && (
                    <div
                      className={cn(
                        "my-1 w-px flex-1 rounded-full",
                        done ? "bg-primary" : "bg-muted-foreground/15"
                      )}
                      style={{ minHeight: "1.75rem" }}
                    />
                  )}
                </div>
                <div className="pt-0.5 pb-6">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      done && "text-foreground",
                      active && "text-primary",
                      !done && !active && "text-muted-foreground/60"
                    )}
                  >
                    {statusLabel(status)}
                  </p>
                  {active && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      In progress · ETA{" "}
                      {application.estimatedDecisionWindowLabel}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-[11px] leading-snug text-muted-foreground">
          <p className="font-semibold text-foreground">What happens next</p>
          <p className="mt-1">
            {application.licenceType === "EXCEPTIONAL"
              ? "Directorate confirms police escort, then forwards to the President for signature. You'll be notified at each transition; fee becomes payable on ACTIVE."
              : application.licenceType === "PORT_EXEMPT"
                ? "Port-corridor traffic is audit-only — no fee. Once cleared, the licence appears in the enforcement feed and roadside QR lookup confirms compliance."
                : "Directorate reviews the night-restricted operating window, then forwards to the President for signature. Fee becomes payable on ACTIVE."}
          </p>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onSubmitAnother}
          className="rounded-lg"
        >
          <Plus />
          Submit another
        </Button>
        <Button size="lg" onClick={onViewApplications} className="rounded-lg">
          View applications
          <ArrowRight />
        </Button>
      </div>
    </>
  )
}

// ── Right rail: submission preview (path B) ─────────────────────────────────
function SubmissionPreview({
  form,
  decision,
  route,
  step,
  onPrimary,
  primaryDisabled,
}: {
  form: FormState
  decision: AccessDecision | null
  route: Route | null
  step: StepKey
  onPrimary: () => void
  primaryDisabled: boolean
}) {
  const vehicle = form.vehicle
  const fee =
    vehicle && decision
      ? resolveFee({
          vehicle,
          licenceType: decision.licenceType,
          durationDays: form.durationDays,
        })
      : null
  const totalLabel =
    !decision || !vehicle
      ? "—"
      : decision.feeExempt
        ? "Fee-exempt"
        : `${formatMzn(fee?.totalMzn ?? 0)} MZN`

  const primaryLabel =
    step === "vehicle"
      ? "Continue to route"
      : step === "route"
        ? "Continue to window"
        : step === "window"
          ? decision?.licenceType === "EXCEPTIONAL"
            ? "Continue to attachments"
            : "Continue to review"
          : step === "attachments"
            ? "Continue to review"
            : "Submit for verification"

  return (
    <section className="relative overflow-hidden rounded-xl bg-sidebar p-5 text-sidebar-foreground">
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 h-12 w-24 rounded-tl-xl border-r-2 border-b-2 border-secondary"
      />
      <p className="text-[10px] font-semibold tracking-widest text-secondary uppercase">
        Submission preview
      </p>

      <div className="mt-3 space-y-2 border-b border-sidebar-border/40 pb-3 text-xs">
        <SummaryLine label="Vehicle" value={vehicle?.plate ?? "—"} mono />
        <SummaryLine
          label="Class"
          value={vehicle ? classifyFleetVehicle(vehicle) : "—"}
        />
        <SummaryLine label="Route" value={route?.routeName ?? "—"} />
        <SummaryLine
          label="Licence"
          value={decision ? licenceTypeLabel(decision.licenceType) : "—"}
        />
        <SummaryLine
          label="Window"
          value={decision?.lockedTimeWindow?.label ?? "Per range"}
        />
        <SummaryLine label="Days" value={`${form.durationDays}`} />
      </div>

      <div className="mt-3 space-y-2 border-b border-sidebar-border/40 pb-3 text-xs">
        <SummaryLine
          label="Fee due on activation"
          value={totalLabel}
          tone={decision?.feeExempt ? "amber" : undefined}
        />
        <SummaryLine
          label="Police escort"
          value={decision?.requiresEscort ? "Required" : "—"}
        />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <p className="text-sm text-sidebar-foreground/80">Status</p>
        <p className="text-base font-semibold tracking-tight">
          Awaiting submission
        </p>
      </div>

      <Button
        size="lg"
        onClick={onPrimary}
        disabled={primaryDisabled}
        className="mt-4 w-full rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90"
      >
        {primaryLabel}
        <ArrowRight />
      </Button>
      <p className="mt-3 text-center text-[11px] text-sidebar-foreground/60">
        Restricted-heavy licences are payable only after the Municipal
        Directorate approves the application (TX-01).
      </p>
    </section>
  )
}
