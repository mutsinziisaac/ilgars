import { useMemo, useState } from "react"
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CreditCard,
  FileText,
  Map as MapIcon,
  QrCode,
  Route as RouteIcon,
  Search,
  Smartphone,
  Truck,
  Wallet,
} from "lucide-react"
import type { DateRange } from "react-day-picker"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { useAuth } from "@/components/auth/auth-context"
import { StatusPill } from "@/components/fleet/status-pill"
import { VerticalStepper, type Step } from "@/components/fleet/vertical-stepper"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  MONTHLY_CAP_MZN,
  WALLET_BALANCE_MZN,
  WEIGHT_TIERS,
  formatMzn,
  generateReceipt,
  weightTierForKg,
  type PaymentChannel,
  type PaymentResult,
  type Receipt,
  type Vehicle,
} from "@/lib/fleet"
import {
  compactPlateNumber,
  getVehicleByPlate,
  type MotorVehicleLogbook,
} from "@/lib/motor-vehicle-api"
import {
  createPrepaidTrip,
  createSpecialPermitRouteRequest,
  listMunicipalRoutes,
  MUNICIPALITY_ID,
  type MunicipalRoute,
  type SpecialPermitRouteRequest,
  type TripCreateResult,
  type TripInvoice,
} from "@/lib/trips-api"
import { classifyFleetVehicle, type WeightCategory } from "@/lib/v4-rules"
import { cn } from "@/lib/utils"

type StepKey =
  | "vehicle"
  | "circulation"
  | "route"
  | "invoice"
  | "payment"
  | "processing"
  | "receipt"
  | "submitted"

type ChargeKind = "daily" | "special"

type FormState = {
  vehicle: Vehicle | null
  sourceVehicle: MotorVehicleLogbook | null
  chargeKind: ChargeKind
  durationDays: number
  range: DateRange
  routeId: string | null
  routeName: string
  tripResult: TripCreateResult | null
  routeRequest: SpecialPermitRouteRequest | null
  channel: PaymentChannel
  paymentResult: PaymentResult | null
}

const today0 = startOfDay(new Date())
const initialEnd = addDays(today0, 1)

const INITIAL_STATE: FormState = {
  vehicle: null,
  sourceVehicle: null,
  chargeKind: "daily",
  durationDays: 2,
  range: { from: today0, to: initialEnd },
  routeId: null,
  routeName: "",
  tripResult: null,
  routeRequest: null,
  channel: "mobile",
  paymentResult: null,
}

const BASE_STEPS: readonly Step<StepKey>[] = [
  { key: "vehicle", label: "Vehicle", description: "Search mock MVR" },
  { key: "circulation", label: "Circulation", description: "Daily or 30 days" },
  { key: "invoice", label: "Invoice", description: "PRN generated" },
  { key: "payment", label: "Payment", description: "Settle PRN" },
]

const HEAVY_STEPS: readonly Step<StepKey>[] = [
  { key: "vehicle", label: "Vehicle", description: "Search mock MVR" },
  { key: "circulation", label: "Circulation", description: "Dates + calendar" },
  { key: "route", label: "Route", description: "Known or request" },
  { key: "invoice", label: "Invoice", description: "PRN generated" },
  { key: "payment", label: "Payment", description: "Settle PRN" },
]

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

function plateLabel(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "")
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
    model: makeModel || record.truckNumber || "Mock registry vehicle",
    year,
    axles,
    configuration: weightKg >= 25_000 ? "4x2 articulated" : "Rigid",
    weightKg,
    color: record.colour ?? "Not recorded",
    rucClass: weightKg > 16_000 ? "Heavy vehicle" : "Medium vehicle",
    chassisVin: record.vinOrChassis ?? record.id,
    engineNumber: record.engineNumber ?? "Not recorded",
    logbookRef: record.logbookNumber ?? record.logbookSeries ?? "MVR mock",
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

function isHeavy(category: WeightCategory | null) {
  return category === "RESTRICTED_HEAVY"
}

function imageForWeightKg(weightKg: number) {
  const tier = weightTierForKg(weightKg)
  return tier ? VEHICLE_IMAGE_BY_WEIGHT_TIER[tier.key] : VEHICLE_IMAGES[0]
}

function randomRouteGeoJson(routeName: string) {
  const seed = Math.floor(Math.random() * 1000) / 100000
  const coordinates: [number, number][] = [
    [32.443 + seed, -25.965 - seed],
    [32.529 + seed, -25.951 - seed],
    [32.573 + seed, -25.961 - seed],
  ]
  return {
    type: "Feature" as const,
    geometry: { type: "LineString" as const, coordinates },
    properties: { name: routeName },
  }
}

function invoiceAmount(invoice: TripInvoice | null, fallback: number) {
  const value = invoice?.amount ?? invoice?.totalAmount
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function invoiceCurrency(invoice: TripInvoice | null) {
  return typeof invoice?.currency === "string" ? invoice.currency : "MZN"
}

function invoicePrn(invoice: TripInvoice | null) {
  return typeof invoice?.prn === "string" && invoice.prn
    ? invoice.prn
    : "PRN-STUB-PENDING"
}

function paymentChannelLabel(channel: PaymentChannel) {
  return PAYMENT_CHANNELS.find((c) => c.key === channel)?.title ?? channel
}

export default function PayCharges() {
  const { user } = useAuth()
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [step, setStep] = useState<StepKey>("vehicle")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const weightCategory = form.vehicle
    ? classifyFleetVehicle(form.vehicle)
    : null
  const heavy = isHeavy(weightCategory)
  const steps = heavy ? HEAVY_STEPS : BASE_STEPS
  const activeInvoice = form.tripResult?.invoice ?? null
  const estimatedTotal = estimateTotal(form)
  const payableTotal = invoiceAmount(activeInvoice, estimatedTotal)

  const goTo = (next: StepKey) => setStep(next)
  const reset = () => {
    setForm(INITIAL_STATE)
    setStep("vehicle")
  }

  const createTripAndInvoice = async (routeId?: string | null) => {
    if (!form.vehicle) return
    if (!MUNICIPALITY_ID) {
      toast.error("Municipality ID missing", {
        description: "Set VITE_MUNICIPALITY_ID before creating trips.",
      })
      return
    }
    setIsSubmitting(true)
    setStep("processing")
    try {
      const result = await createPrepaidTrip({
        vehicleId: form.vehicle.ref,
        municipalityId: MUNICIPALITY_ID,
        paymentMode: "PREPAID",
        expectedDurationDays:
          form.chargeKind === "special" ? 30 : form.durationDays,
        createdBy: user.displayName || "driver-app",
        reason: "pre-declared before Maputo entry",
        ...(routeId ? { routeId } : {}),
      })
      setForm((current) => ({ ...current, tripResult: result }))
      toast.success("Trip declared", {
        description: `${form.vehicle.plate} has an invoice and PRN ready.`,
      })
      setStep("invoice")
    } catch (error) {
      toast.error("Trip creation failed", {
        description: error instanceof Error ? error.message : "Try again.",
      })
      setStep(heavy ? "route" : "circulation")
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitUnknownRoute = async () => {
    if (!form.vehicle) return
    if (!MUNICIPALITY_ID) {
      toast.error("Municipality ID missing", {
        description: "Set VITE_MUNICIPALITY_ID before creating route requests.",
      })
      return
    }
    const routeName =
      form.routeName.trim() || `Unknown Maputo route for ${form.vehicle.plate}`
    setIsSubmitting(true)
    setStep("processing")
    try {
      const request = await createSpecialPermitRouteRequest({
        vehicleId: form.vehicle.ref,
        municipalityId: MUNICIPALITY_ID,
        paymentMode: "PREPAID",
        expectedDurationDays:
          form.chargeKind === "special" ? 30 : form.durationDays,
        routeName,
        routeGeoJson: randomRouteGeoJson(routeName),
        requestedBy: user.displayName || "driver-app",
        notes: "Known route was not available in the list",
      })
      setForm((current) => ({ ...current, routeRequest: request }))
      toast.success("Route request submitted", {
        description: "Security review is pending. No invoice is created yet.",
      })
      setStep("submitted")
    } catch (error) {
      toast.error("Route request failed", {
        description: error instanceof Error ? error.message : "Try again.",
      })
      setStep("route")
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitPayment = () => {
    if (!form.vehicle || !form.tripResult) return
    const receipt: Receipt = generateReceipt({
      vehicle: form.vehicle,
      category:
        form.chargeKind === "special"
          ? "Special circulation licence"
          : `Daily circulation · ${weightTierForKg(form.vehicle.weightKg)?.label ?? "standard"}`,
      durationDays: form.chargeKind === "special" ? 30 : form.durationDays,
      rangeFromIso: (form.range.from ?? today0).toISOString(),
      rangeToIso: (form.range.to ?? form.range.from ?? today0).toISOString(),
      subtotalMzn: payableTotal,
      penaltyMzn: 0,
      capAdjustmentMzn: Math.max(0, estimatedTotal - payableTotal),
      totalMzn: payableTotal,
      channel: form.channel,
      channelLabel: paymentChannelLabel(form.channel),
      status: "paid",
    })
    setForm((current) => ({
      ...current,
      paymentResult: { kind: "success", receipt },
    }))
    setStep("receipt")
  }

  return (
    <div
      className={cn(
        "gap-8 pt-2 pb-20",
        step === "processing" || step === "receipt" || step === "submitted"
          ? "mx-auto flex max-w-3xl flex-col"
          : "grid grid-cols-[220px_minmax(0,1fr)_320px]"
      )}
    >
      {step !== "processing" && step !== "receipt" && step !== "submitted" && (
        <aside className="sticky top-20 self-start">
          <VerticalStepper
            steps={steps}
            currentKey={step}
            onJump={(key) => setStep(key)}
          />
        </aside>
      )}

      <main className="flex flex-col gap-5">
        {step === "vehicle" && (
          <VehicleStep
            selected={form.sourceVehicle}
            onSelect={(record) =>
              setForm({
                ...INITIAL_STATE,
                sourceVehicle: record,
                vehicle: motorVehicleToVehicle(record),
              })
            }
            onContinue={() => goTo("circulation")}
          />
        )}

        {step === "circulation" && form.vehicle && (
          <CirculationStep
            form={form}
            setForm={setForm}
            onBack={() => goTo("vehicle")}
            onContinue={() => {
              if (heavy) goTo("route")
              else void createTripAndInvoice()
            }}
          />
        )}

        {step === "route" && form.vehicle && (
          <RouteStep
            form={form}
            setForm={setForm}
            onBack={() => goTo("circulation")}
            onKnownRoute={(routeId) => void createTripAndInvoice(routeId)}
            onUnknownRoute={() => void submitUnknownRoute()}
          />
        )}

        {step === "invoice" && form.vehicle && form.tripResult && (
          <InvoiceStep
            form={form}
            total={payableTotal}
            onBack={() => goTo(heavy ? "route" : "circulation")}
            onContinue={() => goTo("payment")}
          />
        )}

        {step === "payment" && form.vehicle && form.tripResult && (
          <PaymentStep
            form={form}
            total={payableTotal}
            setForm={setForm}
            onBack={() => goTo("invoice")}
            onSubmit={submitPayment}
          />
        )}

        {step === "processing" && (
          <ProcessingStep
            label={
              isSubmitting && heavy && !form.routeId
                ? "Submitting route request..."
                : "Creating trip and PRN..."
            }
          />
        )}

        {step === "receipt" && form.paymentResult?.kind === "success" && (
          <ReceiptStep result={form.paymentResult} onNewTrip={reset} />
        )}

        {step === "submitted" && form.routeRequest && (
          <SubmittedStep request={form.routeRequest} onNewTrip={reset} />
        )}
      </main>

      {step !== "processing" && step !== "receipt" && step !== "submitted" && (
        <aside className="sticky top-20 self-start">
          <TripSummary
            form={form}
            category={weightCategory}
            total={payableTotal}
            step={step}
            onPrimary={() => {
              if (step === "vehicle") goTo("circulation")
              else if (step === "circulation") {
                if (heavy) goTo("route")
                else void createTripAndInvoice()
              } else if (step === "route" && form.routeId)
                void createTripAndInvoice(form.routeId)
              else if (step === "invoice") goTo("payment")
              else if (step === "payment") submitPayment()
            }}
          />
        </aside>
      )}
    </div>
  )
}

function estimateTotal(form: FormState): number {
  if (!form.vehicle) return 0
  if (form.chargeKind === "special") return MONTHLY_CAP_MZN
  const tier = weightTierForKg(form.vehicle.weightKg) ?? WEIGHT_TIERS[0]
  return Math.min(tier.mznPerDay * form.durationDays, MONTHLY_CAP_MZN)
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
}: {
  eyebrow: string
  description?: string
}) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {eyebrow}
      </p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

function VehicleStep({
  selected,
  onSelect,
  onContinue,
}: {
  selected: MotorVehicleLogbook | null
  onSelect: (record: MotorVehicleLogbook) => void
  onContinue: () => void
}) {
  const [plate, setPlate] = useState(selected?.plateNumber ?? "")
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const selectedVehicle = selected ? motorVehicleToVehicle(selected) : null
  const selectedCategory = selectedVehicle
    ? classifyFleetVehicle(selectedVehicle)
    : null
  const vehicleImage = selectedVehicle
    ? imageForWeightKg(selectedVehicle.weightKg)
    : null

  const lookup = async () => {
    const compact = compactPlateNumber(plate)
    if (!compact) {
      setLookupError("Enter a plate number to look up.")
      return
    }
    setIsLookingUp(true)
    setLookupError(null)
    try {
      const record = await getVehicleByPlate(compact)
      onSelect(record)
      toast.success("Vehicle found", {
        description: `${plateLabel(record.plateNumber)} is ready for trip creation.`,
      })
    } catch (error) {
      setLookupError(
        error instanceof Error
          ? error.message
          : "Vehicle was not found in Motorvehicle."
      )
    } finally {
      setIsLookingUp(false)
    }
  }

  return (
    <>
      <Card className="gap-5">
        <SectionHeader
          eyebrow="Lookup vehicle"
          description="Enter a plate number. The trip flow uses the Motorvehicle lookup record for rating, invoice, and route decisions."
        />

        <div className="grid grid-cols-1 gap-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row">
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
                      void lookup()
                    }
                  }}
                  placeholder="Enter plate, e.g. AHS270MP"
                  className="h-10 rounded-lg pl-8 font-mono text-sm tracking-wide"
                />
              </div>
              <Button
                type="button"
                onClick={() => void lookup()}
                disabled={isLookingUp}
                className="h-10 rounded-lg"
              >
                {isLookingUp ? <Spinner /> : <Search className="size-3.5" />}
                Lookup
              </Button>
            </div>

            {lookupError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {lookupError}
              </div>
            )}

            {selected && selectedVehicle ? (
              <VehicleDetailsCard
                record={selected}
                vehicle={selectedVehicle}
                category={selectedCategory}
                image={vehicleImage}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground">
                    <Truck className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      No vehicle selected
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Lookup a plate in Motorvehicle to pull make, model,
                      capacity, owner/operator, and logbook identifiers before
                      continuing.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Footer
        backLabel="Cancel"
        continueLabel="Continue to circulation"
        onBack={() => history.back()}
        onContinue={onContinue}
        disabled={!selected}
      />
    </>
  )
}

function VehicleDetailsCard({
  record,
  vehicle,
  category,
  image,
}: {
  record: MotorVehicleLogbook
  vehicle: Vehicle
  category: WeightCategory | null
  image: string | null
}) {
  const capacityLabel = vehicle.weightKg
    ? `${formatMzn(vehicle.weightKg)} kg`
    : "Not recorded"
  const tier = weightTierForKg(vehicle.weightKg)
  const tone = category === "RESTRICTED_HEAVY" ? "warning" : "compliant"
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="grid gap-4 border-b border-border bg-muted/30 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Motorvehicle record
            </p>
            <h2 className="mt-1 truncate font-mono text-2xl font-semibold tracking-wide text-foreground">
              {vehicle.plate}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {vehicle.model} · {record.truckNumber ?? "No truck number"}
            </p>
          </div>
          <StatusPill tone={tone}>
            {category === "RESTRICTED_HEAVY"
              ? "Heavy route required"
              : "Medium direct PRN"}
          </StatusPill>
        </div>

        {image && (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="aspect-[4/3]">
              <img
                src={image}
                alt={`${vehicle.plate} ${tier?.label ?? "vehicle"} weight class`}
                className="h-full w-full object-contain p-3"
              />
            </div>
            <div className="border-t border-border px-3 py-2">
              <p className="text-xs font-medium text-foreground">
                {tier?.rangeLabel ?? "Below rated range"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <Meta label="Capacity / GVW" value={capacityLabel} />
        <Meta
          label="Operator"
          value={
            record.operatorName ?? record.operatorReference ?? "Not recorded"
          }
        />
        <Meta label="Logbook" value={vehicle.logbookRef} mono />
        <Meta label="Chassis / VIN" value={vehicle.chassisVin} mono />
        <Meta label="Engine" value={vehicle.engineNumber} mono />
        <Meta label="Fuel" value={record.fuelType ?? "Not recorded"} />
        <Meta label="Colour" value={vehicle.color} />
        <Meta label="Registry status" value={record.status ?? "Not recorded"} />
      </div>
    </div>
  )
}

function CirculationStep({
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
  const setDays = (days: number) => {
    setForm((current) => {
      const from = current.range.from ?? today0
      return {
        ...current,
        chargeKind: days === 30 ? "special" : "daily",
        durationDays: days,
        range: { from, to: addDays(from, days - 1) },
        tripResult: null,
      }
    })
  }
  const setRange = (range: DateRange | undefined) => {
    if (!range?.from) return
    const from = range.from
    const to = range.to ?? from
    setForm((current) => ({
      ...current,
      chargeKind: "daily",
      durationDays: differenceInCalendarDays(to, from) + 1,
      range: { from, to },
      tripResult: null,
    }))
  }

  return (
    <>
      <Card>
        <SectionHeader
          eyebrow="Daily / special circulation"
          description="Pick daily circulation or the 30-day special circulation licence, then confirm dates on the calendar."
        />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 7, 14, 30].map((days) => {
            const active = form.durationDays === days
            return (
              <button
                key={days}
                type="button"
                onClick={() => setDays(days)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                {days === 30
                  ? "Special · 30 days"
                  : `${days} day${days === 1 ? "" : "s"}`}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DateBlock label="Starts" date={form.range.from} />
          <DateBlock label="Ends" date={form.range.to} />
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-muted/20 p-2">
          <Calendar
            mode="range"
            selected={form.range}
            onSelect={setRange}
            defaultMonth={form.range.from ?? today0}
            className="w-full bg-transparent"
          />
        </div>
      </Card>
      <Footer
        backLabel="Back to vehicle"
        continueLabel="Continue"
        onBack={onBack}
        onContinue={onContinue}
        disabled={!form.range.from || !form.range.to || form.durationDays < 1}
      />
    </>
  )
}

function RouteStep({
  form,
  setForm,
  onBack,
  onKnownRoute,
  onUnknownRoute,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onBack: () => void
  onKnownRoute: (routeId: string) => void
  onUnknownRoute: () => void
}) {
  const [query, setQuery] = useState("")
  const routesQuery = useQuery({
    queryKey: ["municipal-routes", MUNICIPALITY_ID],
    queryFn: () => listMunicipalRoutes(MUNICIPALITY_ID),
    enabled: !!MUNICIPALITY_ID,
  })
  const routes = routesQuery.data ?? []
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return routes
    return routes.filter((route) => routeLabel(route).toLowerCase().includes(q))
  }, [query, routes])

  return (
    <>
      <Card>
        <SectionHeader
          eyebrow="Route selection"
          description="Heavy trucks require an active special-permit route. If the route is not listed, submit a route request with test coordinates for security review."
        />
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setForm((current) => ({
                ...current,
                routeName: event.target.value,
              }))
            }}
            placeholder="Search known route or type an unknown route name..."
            className="h-9 rounded-lg pl-8 text-sm"
          />
        </div>

        {routesQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10 text-sm text-muted-foreground">
            <Spinner />
            Loading municipal routes...
          </div>
        ) : (
          <ul className="max-h-[360px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {filtered.map((route) => {
              const selected = form.routeId === route.id
              return (
                <li key={route.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        routeId: route.id,
                        routeName: routeLabel(route),
                        tripResult: null,
                      }))
                    }
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      selected ? "bg-primary/5" : "hover:bg-muted/40"
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <RouteIcon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {routeLabel(route)}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {route.routeCode ?? route.id}
                      </span>
                    </span>
                    {selected && (
                      <StatusPill tone="compliant">Selected</StatusPill>
                    )}
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 && (
              <li className="px-4 py-8 text-center text-xs text-muted-foreground">
                No active route matches this search.
              </li>
            )}
          </ul>
        )}

        <div className="flex items-start gap-3 rounded-xl border border-secondary/40 bg-accent/60 p-4">
          <MapIcon className="mt-0.5 size-4 shrink-0 text-secondary" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Route not defined
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              This sends a special-permit route request with generated Maputo
              test coordinates. The API creates no trip, invoice, or PRN until
              review is complete.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onUnknownRoute}>
            Submit request
          </Button>
        </div>
      </Card>
      <Footer
        backLabel="Back to circulation"
        continueLabel="Create trip with route"
        onBack={onBack}
        onContinue={() => form.routeId && onKnownRoute(form.routeId)}
        disabled={!form.routeId}
      />
    </>
  )
}

function routeLabel(route: MunicipalRoute) {
  return route.routeName ?? route.name ?? route.routeCode ?? route.id
}

function InvoiceStep({
  form,
  total,
  onBack,
  onContinue,
}: {
  form: FormState
  total: number
  onBack: () => void
  onContinue: () => void
}) {
  const vehicle = form.vehicle!
  const invoice = form.tripResult?.invoice ?? null
  const prn = invoicePrn(invoice)
  const currency = invoiceCurrency(invoice)
  return (
    <>
      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border bg-sidebar p-6 text-sidebar-foreground">
          <div className="flex items-start gap-3">
            <img
              src="/maputo-logo.webp"
              alt="Municipio de Maputo"
              className="size-14 shrink-0 rounded-lg bg-card object-contain p-1"
            />
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-secondary uppercase">
                New trip invoice
              </p>
              <p className="mt-0.5 text-base leading-tight font-semibold">
                Conselho Municipal de Maputo
              </p>
              <p className="text-[11px] leading-snug text-sidebar-foreground/70">
                PRN generated by Core for prepaid circulation
              </p>
            </div>
          </div>
          <StatusPill tone="compliant">
            {invoice?.status ?? "PRN_GENERATED"}
          </StatusPill>
        </header>
        <section className="grid grid-cols-1 gap-6 border-b border-border p-6 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Vehicle
            </p>
            <p className="mt-1.5 font-mono text-lg font-semibold tracking-wide text-foreground">
              {vehicle.plate}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {vehicle.model} · {formatMzn(vehicle.weightKg)} kg
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
            <Meta label="Trip" value={form.tripResult?.trip.id ?? "-"} mono />
            <Meta label="PRN" value={prn} mono />
            <Meta
              label="Coverage"
              value={`${format(form.range.from ?? today0, "d MMM")} - ${format(
                form.range.to ?? form.range.from ?? today0,
                "d MMM yyyy"
              )}`}
            />
            <Meta
              label="Duration"
              value={`${form.chargeKind === "special" ? 30 : form.durationDays} days`}
            />
          </dl>
        </section>
        <section className="p-6">
          <div className="rounded-lg border border-border bg-muted/30">
            <InvoiceLine
              label={
                form.chargeKind === "special"
                  ? "Special circulation licence"
                  : "Daily circulation"
              }
              value={`${formatMzn(total)} ${currency}`}
            />
            <InvoiceLine label="PRN" value={prn} mono />
            <InvoiceLine
              label="Total payable"
              value={`${formatMzn(total)} ${currency}`}
              emphasised
            />
          </div>
        </section>
      </article>
      <Footer
        backLabel="Back"
        continueLabel="Continue to PRN payment"
        onBack={onBack}
        onContinue={onContinue}
      />
    </>
  )
}

function PaymentStep({
  form,
  total,
  setForm,
  onBack,
  onSubmit,
}: {
  form: FormState
  total: number
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onBack: () => void
  onSubmit: () => void
}) {
  const walletShort = form.channel === "wallet" && total > WALLET_BALANCE_MZN
  return (
    <>
      <Card>
        <SectionHeader
          eyebrow="PRN payment"
          description={`Settle ${invoicePrn(form.tripResult?.invoice ?? null)} using the preferred channel.`}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PAYMENT_CHANNELS.map((channel) => {
            const Icon = channel.icon
            const selected = form.channel === channel.key
            const disabled =
              channel.key === "wallet" && total > WALLET_BALANCE_MZN
            return (
              <button
                key={channel.key}
                type="button"
                disabled={disabled}
                onClick={() =>
                  setForm((current) => ({ ...current, channel: channel.key }))
                }
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  disabled
                    ? "border-dashed border-border/60 bg-muted/30 opacity-60"
                    : selected
                      ? "border-primary bg-primary/5"
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
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    {channel.title}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {channel.subtitle}
                  </span>
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
              A USSD prompt will authorise the {formatMzn(total)} MZN debit.
            </FieldDescription>
          </Field>
        )}
      </Card>
      <Footer
        backLabel="Back to invoice"
        continueLabel={`Pay ${formatMzn(total)} MZN`}
        onBack={onBack}
        onContinue={onSubmit}
        disabled={walletShort}
      />
    </>
  )
}

function ProcessingStep({ label }: { label: string }) {
  return (
    <Card className="items-center text-center">
      <div className="flex flex-col items-center gap-4 py-8">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileText className="size-6" />
        </span>
        <Spinner className="size-5 text-primary" />
        <div>
          <p className="text-base font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Waiting for the deployed Core API response.
          </p>
        </div>
      </div>
    </Card>
  )
}

function ReceiptStep({
  result,
  onNewTrip,
}: {
  result: Extract<PaymentResult, { kind: "success" }>
  onNewTrip: () => void
}) {
  const receipt = result.receipt
  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <BadgeCheck className="size-5" />
        </span>
        <div className="flex-1">
          <p className="text-base font-semibold text-foreground">
            Payment confirmed
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatMzn(receipt.totalMzn)} MZN charged to {receipt.channelLabel}.
            Receipt {receipt.number} issued.
          </p>
        </div>
        <StatusPill tone="compliant">Paid</StatusPill>
      </div>
      <Card>
        <SectionHeader
          eyebrow="Digital receipt"
          description="Vehicle tax receipt for roadside verification."
        />
        <div className="relative mx-auto flex aspect-square w-full max-w-[380px] flex-col items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-card p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)] ring-8 ring-primary/5">
          <img
            src="/maputo-logo.webp"
            alt=""
            aria-hidden
            className="pointer-events-none absolute h-60 w-60 object-contain opacity-[0.14]"
          />
          <div className="relative min-w-0">
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              Paid road user charge
            </p>
            <p className="mt-2 font-mono text-3xl font-semibold tracking-wide text-foreground">
              {receipt.vehiclePlate}
            </p>
            <p className="mx-auto mt-2 max-w-56 text-sm leading-snug text-muted-foreground">
              {receipt.category}
            </p>
            <p className="mt-4 font-mono text-xs font-medium text-foreground">
              {receipt.number}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatMzn(receipt.totalMzn)} MZN · {receipt.channelLabel}
            </p>
          </div>
          <div className="relative mt-7 flex size-24 items-center justify-center rounded-full border border-border bg-background/90 shadow-sm">
            <QrCode className="size-14 text-foreground" />
          </div>
        </div>
      </Card>
      <Footer
        backLabel="View trips"
        continueLabel="Create another trip"
        onBack={() => history.back()}
        onContinue={onNewTrip}
      />
    </>
  )
}

function SubmittedStep({
  request,
  onNewTrip,
}: {
  request: SpecialPermitRouteRequest
  onNewTrip: () => void
}) {
  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-secondary/40 bg-accent/60 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary">
          <AlertTriangle className="size-5" />
        </span>
        <div className="flex-1">
          <p className="text-base font-semibold text-foreground">
            Route request submitted
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {request.routeName} is {request.status}. No trip, invoice, or PRN is
            created until review is complete.
          </p>
        </div>
        <StatusPill tone="warning">Pending review</StatusPill>
      </div>
      <Card>
        <SectionHeader eyebrow="Request details" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Meta label="Request ID" value={request.id} mono />
          <Meta label="Vehicle" value={request.vehicleId} mono />
          <Meta label="Municipality" value={request.municipalityId} mono />
          <Meta
            label="Duration"
            value={`${request.expectedDurationDays} days`}
          />
        </div>
      </Card>
      <Footer
        backLabel="View trips"
        continueLabel="Create another trip"
        onBack={() => history.back()}
        onContinue={onNewTrip}
      />
    </>
  )
}

function TripSummary({
  form,
  category,
  total,
  step,
  onPrimary,
}: {
  form: FormState
  category: WeightCategory | null
  total: number
  step: StepKey
  onPrimary: () => void
}) {
  const primaryLabel =
    step === "vehicle"
      ? "Continue to circulation"
      : step === "circulation"
        ? category === "RESTRICTED_HEAVY"
          ? "Continue to route"
          : "Create trip + PRN"
        : step === "route"
          ? "Create trip + PRN"
          : step === "invoice"
            ? "Continue to payment"
            : `Pay ${formatMzn(total)} MZN`
  const disabled =
    step === "vehicle"
      ? !form.vehicle
      : step === "circulation"
        ? !form.range.from || !form.range.to
        : step === "route"
          ? !form.routeId
          : false

  return (
    <section className="relative overflow-hidden rounded-xl bg-sidebar p-5 text-sidebar-foreground">
      <p className="text-[10px] font-semibold tracking-widest text-secondary uppercase">
        Trip summary
      </p>
      <div className="mt-3 space-y-2 border-b border-sidebar-border/40 pb-3 text-xs">
        <SummaryLine label="Vehicle" value={form.vehicle?.plate ?? "-"} mono />
        <SummaryLine label="Class" value={category ?? "-"} />
        <SummaryLine
          label="Circulation"
          value={form.chargeKind === "special" ? "Special · 30 days" : "Daily"}
        />
        <SummaryLine label="Days" value={`${form.durationDays}`} />
        {category === "RESTRICTED_HEAVY" && (
          <SummaryLine label="Route" value={form.routeName || "-"} />
        )}
      </div>
      <div className="mt-4 flex items-end justify-between">
        <p className="text-sm text-sidebar-foreground/80">Estimated total</p>
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
        disabled={disabled}
        className="mt-4 w-full rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90"
      >
        {primaryLabel}
        <ArrowRight />
      </Button>
    </section>
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

function DateBlock({ label, date }: { label: string; date: Date | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-foreground">
        {date ? format(date, "EEE, d MMM yyyy") : "-"}
      </p>
    </div>
  )
}

function Meta({
  label,
  value,
  mono,
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

function InvoiceLine({
  label,
  value,
  mono,
  emphasised,
}: {
  label: string
  value: string
  mono?: boolean
  emphasised?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 text-sm not-last:border-b not-last:border-border/60",
        emphasised && "bg-card font-semibold"
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium text-foreground tabular-nums",
          mono && "font-mono tracking-wider",
          emphasised && "text-base"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function SummaryLine({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sidebar-foreground/70">{label}</span>
      <span
        className={cn(
          "truncate font-medium text-sidebar-foreground tabular-nums",
          mono && "font-mono"
        )}
      >
        {value}
      </span>
    </div>
  )
}
