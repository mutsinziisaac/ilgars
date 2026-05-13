import { useEffect, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { VehicleIllustration } from "@/components/fleet/vehicle-illustration"
import { VerticalStepper, type Step } from "@/components/fleet/vertical-stepper"
import { useAuth } from "@/components/auth/auth-context"
import {
  formatMzn,
  normalisePlate,
  plateExists,
  weightTierForKg,
} from "@/lib/fleet"
import { ApiError } from "@/lib/api"
import {
  createFleetVehicle,
  type FleetVehicleRegistrationPayload,
} from "@/lib/fleet-vehicles-api"
import {
  compactPlateNumber,
  getVehicleByPlate,
  type MotorVehicleLogbook,
} from "@/lib/motor-vehicle-api"
import { cn } from "@/lib/utils"

type StepKey = "logbook" | "photos" | "review"

const STEPS: readonly Step<StepKey>[] = [
  { key: "logbook", label: "Logbook (MVR)", description: "Pull from registry" },
  { key: "photos", label: "Photos", description: "6 angles, JPEG/PNG ≤ 5 MB" },
  {
    key: "review",
    label: "Review & submit",
    description: "Confirm & register",
  },
]

const STEP_INDEX: Record<StepKey, number> = {
  logbook: 0,
  photos: 1,
  review: 2,
}

const PHOTO_SLOTS = [
  { key: "front", label: "Front" },
  { key: "side-left", label: "Left side" },
  { key: "side-right", label: "Right side" },
  { key: "back", label: "Back" },
  { key: "plate", label: "Plate close-up" },
  { key: "vin", label: "VIN plate" },
] as const
type PhotoKey = (typeof PHOTO_SLOTS)[number]["key"]

type UsageType = "cargo" | "agricultural" | "special"

type FormState = {
  plate: string
  logbookRef: string
  makeModel: string
  year: string
  chassisVin: string
  engineNumber: string
  axles: number
  weightKg: number
  usageType: UsageType
  mvrLocked: boolean
  logbookRecord: MotorVehicleLogbook | null
  photos: Partial<Record<PhotoKey, File>>
  photoErrors: Partial<Record<PhotoKey, string>>
}

const INITIAL_STATE: FormState = {
  plate: "",
  logbookRef: "",
  makeModel: "",
  year: "",
  chassisVin: "",
  engineNumber: "",
  axles: 4,
  weightKg: 0,
  usageType: "cargo",
  mvrLocked: false,
  logbookRecord: null,
  photos: {},
  photoErrors: {},
}

const PHOTO_MAX_BYTES = 5 * 1024 * 1024

function tonnesFromKg(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Number((value / 1000).toFixed(4))
    : null
}

function capacityTonnes(record: MotorVehicleLogbook, fallbackKg: number) {
  if (
    typeof record.currentLogbookCapacity === "number" &&
    Number.isFinite(record.currentLogbookCapacity)
  ) {
    const value = record.currentLogbookCapacity
    return value > 1000 ? Number((value / 1000).toFixed(4)) : value
  }

  return (
    tonnesFromKg(record.logbookCapacityKg) ??
    tonnesFromKg(record.grossWeightTotalKg) ??
    tonnesFromKg(fallbackKg) ??
    0
  )
}

function buildFleetVehiclePayload(
  form: FormState,
  ownerName: string
): FleetVehicleRegistrationPayload | null {
  const record = form.logbookRecord
  if (!record?.id) return null

  const plateNumber = compactPlateNumber(record.plateNumber || form.plate)
  return {
    vehicleId: record.id,
    plateNumber,
    truckNumber: record.truckNumber || `TRK-${plateNumber}`,
    ownerName,
    operatorName: record.operatorName || "Demo Operator",
    capacitySnapshot: capacityTonnes(record, form.weightKg),
    capacityUnit: "TONNES",
    registryStatus: record.status?.trim().toUpperCase() || "ACTIVE",
    exemptionStatus: record.exemptionStatus?.trim().toUpperCase() || "NONE",
    compliantForRating: true,
    source: "OWNER_SELECTED",
  }
}

export default function VehicleNew() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const stepParam = (params.get("step") ?? "logbook") as StepKey
  const step: StepKey =
    STEP_INDEX[stepParam] !== undefined ? stepParam : "logbook"
  const returnTo = params.get("returnTo")
  const [form, setForm] = useState<FormState>(() => {
    const platePrefill = params.get("plate")
    if (!platePrefill) return INITIAL_STATE
    return { ...INITIAL_STATE, plate: normalisePlate(platePrefill) }
  })

  useEffect(() => {
    if (params.get("step") !== step) {
      // Preserve returnTo / plate while syncing the step param
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
    const i = STEP_INDEX[step]
    if (i === 0) navigate(returnTo ?? "/portal/fleet")
    else goTo(STEPS[i - 1].key)
  }

  const registerMutation = useMutation({
    mutationFn: createFleetVehicle,
    onSuccess: async (vehicle) => {
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] })
      toast.success(
        `Vehicle ${vehicle.plateNumberSnapshot || form.plate} registered`,
        {
          description: `${vehicle.truckNumberSnapshot || "Fleet vehicle"} is now active in your fleet.`,
        }
      )
      navigate(returnTo ?? "/portal/fleet")
    },
    onError: (error) => {
      toast.error("Vehicle registration failed", {
        description:
          error instanceof Error ? error.message : "Try submitting again.",
      })
    },
  })

  const handleSubmit = () => {
    const payload = buildFleetVehiclePayload(form, user.displayName)
    if (!payload) {
      toast.error("MVR logbook required", {
        description:
          "Look up and select a Motor Vehicle Registry record before submitting.",
      })
      return
    }

    registerMutation.mutate(payload)
  }

  return (
    <div className="grid grid-cols-[220px_minmax(0,1fr)_320px] gap-8 pt-2 pb-20">
      <aside className="sticky top-20 self-start">
        <VerticalStepper
          steps={STEPS}
          currentKey={step}
          onJump={(k) => goTo(k)}
        />
      </aside>

      <div className="flex flex-col gap-5">
        {step === "logbook" && (
          <LogbookStep
            form={form}
            setForm={setForm}
            onContinue={() => goTo("photos")}
          />
        )}
        {step === "photos" && (
          <PhotosStep
            form={form}
            setForm={setForm}
            onBack={back}
            onContinue={() => goTo("review")}
          />
        )}
        {step === "review" && (
          <ReviewStep
            form={form}
            onBack={back}
            onSubmit={handleSubmit}
            isSubmitting={registerMutation.isPending}
          />
        )}
      </div>

      <aside className="sticky top-20 flex flex-col gap-4 self-start">
        <LivePreview form={form} />
        {form.mvrLocked && <SourceVerifiedNote />}
      </aside>
    </div>
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

// ── Step: Logbook (MVR) ─────────────────────────────────────────────────────
function LogbookStep({
  form,
  setForm,
  onContinue,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onContinue: () => void
}) {
  const [plateInput, setPlateInput] = useState(form.plate)
  const [notFound, setNotFound] = useState(false)
  const [duplicate, setDuplicate] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const lookupMutation = useMutation({
    mutationFn: (plate: string) => getVehicleByPlate(plate),
    onSuccess: (record) => {
      const plate = record.plateNumber || compactPlateNumber(plateInput)
      const registrationYear = record.registrationDate
        ? new Date(record.registrationDate).getFullYear()
        : ""

      setNotFound(false)
      setLookupError(null)
      setForm({
        ...INITIAL_STATE,
        plate,
        logbookRef: formatLogbookReference(record),
        makeModel: [record.make, record.model].filter(Boolean).join(" "),
        year:
          typeof registrationYear === "number" &&
          Number.isFinite(registrationYear)
            ? String(registrationYear)
            : "",
        chassisVin: record.vinOrChassis ?? "",
        engineNumber: record.engineNumber ?? "",
        axles: 4,
        weightKg: Math.round(
          record.grossWeightTotalKg ?? record.logbookCapacityKg ?? 0
        ),
        usageType: "cargo",
        mvrLocked: true,
        logbookRecord: record,
        photos: {},
        photoErrors: {},
      })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 404) {
        setNotFound(true)
        setLookupError(null)
        return
      }

      setNotFound(false)
      setLookupError(
        error instanceof Error
          ? error.message
          : "Vehicle lookup failed. Try again."
      )
    },
  })
  const loading = lookupMutation.isPending

  const lookup = async () => {
    const norm = normalisePlate(plateInput)
    if (!norm) return
    if (plateExists(norm)) {
      setDuplicate(true)
      setNotFound(false)
      setLookupError(null)
      return
    }
    setDuplicate(false)
    setNotFound(false)
    setLookupError(null)
    lookupMutation.mutate(norm)
  }

  const startManual = () => {
    setForm({
      ...INITIAL_STATE,
      plate: compactPlateNumber(plateInput),
      mvrLocked: false,
    })
    onContinue()
  }

  return (
    <Card>
      <SectionHeader
        eyebrow="Logbook (MVR)"
        description="Look up your vehicle in the Motor Vehicle Registry. Found records prefill chassis, engine, and class data."
      />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="plate-input">Number plate</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="plate-input"
              value={plateInput}
              onChange={(e) => {
                setPlateInput(e.target.value.toUpperCase())
                setNotFound(false)
                setDuplicate(false)
                setLookupError(null)
              }}
              placeholder="e.g. AHS270MP"
              className="font-mono text-sm tracking-wider"
              spellCheck={false}
              autoComplete="off"
            />
            <InputGroupAddon align="inline-end">
              <Button
                size="sm"
                onClick={lookup}
                disabled={loading || !plateInput.trim()}
                className="rounded-md"
              >
                {loading ? <Spinner /> : <ShieldCheck />}
                {loading ? "Looking up…" : "Look up via MVR"}
              </Button>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription>
            Enter the registered plate. We'll fetch the canonical record from
            MVR; if it isn't there yet you can register manually.
          </FieldDescription>
          {duplicate && (
            <FieldError>
              A vehicle with plate {normalisePlate(plateInput)} is already in
              your fleet.
            </FieldError>
          )}
          {lookupError && <FieldError>{lookupError}</FieldError>}
        </Field>

        {form.logbookRecord && (
          <LogbookRecordPanel
            record={form.logbookRecord}
            onContinue={onContinue}
          />
        )}

        {notFound && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-secondary/40 bg-accent/60 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                No MVR record found
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                We couldn't match {normalisePlate(plateInput)} in MVR. You can
                still register the vehicle manually — fields will be unlocked on
                the next step.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={startManual}
              className="rounded-md"
            >
              Continue manually
            </Button>
          </div>
        )}
      </FieldGroup>
    </Card>
  )
}

function formatLogbookReference(record: MotorVehicleLogbook): string {
  return [record.logbookSeries, record.logbookNumber].filter(Boolean).join(" ")
}

function formatKg(value: number | null): string {
  return typeof value === "number" ? `${formatMzn(value)} kg` : "—"
}

function formatValue(value: string | number | null): string {
  if (typeof value === "number") return formatMzn(value)
  return value && value.trim() !== "" ? value : "—"
}

function LogbookRecordPanel({
  record,
  onContinue,
}: {
  record: MotorVehicleLogbook
  onContinue: () => void
}) {
  const logbookRef = formatLogbookReference(record)

  return (
    <div className="overflow-hidden rounded-xl border border-primary/25 bg-primary/5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-primary/15 bg-card px-4 py-3">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            MVR logbook found
          </p>
          <h2 className="mt-1 font-mono text-lg font-semibold tracking-wider text-foreground">
            {record.plateNumber}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {record.make} {record.model} · Logbook {logbookRef || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            <CheckCircle2 className="size-3.5" />
            {record.status ?? "Verified"}
          </span>
          <Button size="sm" onClick={onContinue} className="rounded-md">
            Use logbook
            <ArrowRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-0 divide-y divide-border/70 md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="p-4">
          <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            Registration
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <SummaryRow label="Plate number" value={record.plateNumber} mono />
            <SummaryRow
              label="Truck number"
              value={record.truckNumber ?? ""}
              mono
            />
            <SummaryRow
              label="Series"
              value={record.logbookSeries ?? ""}
              mono
            />
            <SummaryRow
              label="Number"
              value={record.logbookNumber ?? ""}
              mono
            />
            <SummaryRow
              label="Department"
              value={record.registrationDepartment ?? ""}
            />
            <SummaryRow
              label="Registered"
              value={record.registrationDate ?? ""}
            />
          </dl>
        </div>

        <div className="p-4">
          <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            Vehicle identity
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <SummaryRow label="Make" value={record.make ?? ""} />
            <SummaryRow label="Model" value={record.model ?? ""} />
            <SummaryRow label="Colour" value={record.colour ?? ""} />
            <SummaryRow label="Fuel" value={record.fuelType ?? ""} />
            <SummaryRow
              label="VIN / chassis"
              value={record.vinOrChassis ?? ""}
              mono
            />
            <SummaryRow label="Engine" value={record.engineNumber ?? ""} mono />
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-primary/15 bg-card/70 p-4 md:grid-cols-4">
        <LogbookMetric
          label="Gross total"
          value={formatKg(record.grossWeightTotalKg)}
        />
        <LogbookMetric
          label="Logbook capacity"
          value={formatKg(record.logbookCapacityKg)}
        />
        <LogbookMetric label="Tare" value={formatKg(record.tareWeightKg)} />
        <LogbookMetric
          label="Current capacity"
          value={formatValue(record.currentLogbookCapacity)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-primary/15 p-4 text-sm md:grid-cols-3">
        <SummaryRow label="Operator" value={record.operatorName ?? ""} />
        <SummaryRow
          label="Operator ref"
          value={record.operatorReference ?? ""}
          mono
        />
        <SummaryRow
          label="Weighbridge ref"
          value={record.weighbridgeExternalRef ?? ""}
          mono
        />
        <SummaryRow label="Service type" value={record.serviceType ?? ""} />
        <SummaryRow label="Exemption" value={record.exemptionStatus ?? ""} />
        <SummaryRow label="Tyres" value={record.tyreMeasurements ?? ""} />
      </div>
    </div>
  )
}

function LogbookMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold tracking-wider text-foreground">
        {value}
      </p>
    </div>
  )
}

// ── Step: Photos ────────────────────────────────────────────────────────────
function PhotosStep({
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
  const handleFile = (key: PhotoKey, file: File | null) => {
    setForm((f) => {
      const photos = { ...f.photos }
      const photoErrors = { ...f.photoErrors }
      delete photoErrors[key]
      if (!file) {
        delete photos[key]
        return { ...f, photos, photoErrors }
      }
      if (file.size > PHOTO_MAX_BYTES) {
        photoErrors[key] = "File too large — max 5 MB per photo (BR-002-03)."
        delete photos[key]
        return { ...f, photos, photoErrors }
      }
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        photoErrors[key] = "Use JPEG or PNG (BR-002-03)."
        delete photos[key]
        return { ...f, photos, photoErrors }
      }
      photos[key] = file
      return { ...f, photos, photoErrors }
    })
  }

  const uploadedCount = Object.keys(form.photos).length

  return (
    <>
      <Card>
        <SectionHeader
          eyebrow="Vehicle photos"
          description="Upload 6 angles. JPEG or PNG, up to 5 MB each (BR-002-03)."
          trailing={
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {uploadedCount} of 6 uploaded
            </span>
          }
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {PHOTO_SLOTS.map((slot) => (
            <PhotoTile
              key={slot.key}
              label={slot.label}
              file={form.photos[slot.key]}
              error={form.photoErrors[slot.key]}
              onFile={(f) => handleFile(slot.key, f)}
            />
          ))}
        </div>
      </Card>
      <Footer
        backLabel="Back to logbook"
        continueLabel="Continue to review"
        onBack={onBack}
        onContinue={onContinue}
      />
    </>
  )
}

function PhotoTile({
  label,
  file,
  error,
  onFile,
}: {
  label: string
  file: File | undefined
  error?: string
  onFile: (file: File | null) => void
}) {
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  )
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
    <Field data-invalid={error ? "true" : undefined}>
      <FieldLabel>{label}</FieldLabel>
      <label
        className={cn(
          "group flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-center transition-colors",
          error
            ? "border-destructive/40 bg-destructive/5"
            : file
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-muted/30 hover:border-primary/40 hover:bg-primary/5"
        )}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={label}
            className="h-full w-full rounded-md object-cover"
          />
        ) : (
          <>
            <UploadCloud className="size-5 text-muted-foreground group-hover:text-primary" />
            <span className="text-[11px] text-muted-foreground">
              Click to upload
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              JPEG/PNG · ≤ 5 MB
            </span>
          </>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <button
          type="button"
          onClick={() => onFile(null)}
          className="inline-flex items-center gap-1 self-start text-[11px] font-medium text-muted-foreground hover:text-destructive"
        >
          <X className="size-3" />
          Remove {file.name}
        </button>
      )}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}

// ── Step: Review ────────────────────────────────────────────────────────────
function ReviewStep({
  form,
  onBack,
  onSubmit,
  isSubmitting,
}: {
  form: FormState
  onBack: () => void
  onSubmit: () => void
  isSubmitting: boolean
}) {
  const tier = weightTierForKg(form.weightKg)
  const canSubmit = !!form.logbookRecord?.id && !isSubmitting

  return (
    <>
      <Card>
        <SectionHeader
          eyebrow="Vehicle identity"
          trailing={
            form.mvrLocked && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-primary uppercase">
                MVR ✓
              </span>
            )
          }
        />
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <SummaryRow label="Number plate" value={form.plate} mono />
          <SummaryRow label="Logbook ref" value={form.logbookRef} mono />
          <SummaryRow label="Make & model" value={form.makeModel} />
          <SummaryRow label="Year" value={form.year} />
          <SummaryRow label="Chassis (VIN)" value={form.chassisVin} mono />
          <SummaryRow label="Engine" value={form.engineNumber} mono />
        </dl>
      </Card>

      <Card>
        <SectionHeader eyebrow="RUC classification" />
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <SummaryRow label="Axles" value={`${form.axles}`} />
          <SummaryRow
            label="Gross weight"
            value={`${formatMzn(form.weightKg)} kg`}
          />
          <SummaryRow
            label="Tariff bracket"
            value={
              tier
                ? `${tier.rangeLabel} · ${formatMzn(tier.mznPerDay)} MZN/day`
                : "Below RUC threshold"
            }
          />
          <SummaryRow
            label="Usage"
            value={
              {
                cargo: "Cargo truck (standard freight)",
                agricultural: "Agricultural transit",
                special: "Special permit (case-by-case)",
              }[form.usageType]
            }
          />
        </dl>
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Photos"
          trailing={
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {Object.keys(form.photos).length} of 6 uploaded
            </span>
          }
        />
        <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          {PHOTO_SLOTS.map((slot) => {
            const hasFile = !!form.photos[slot.key]
            return (
              <li
                key={slot.key}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5",
                  hasFile
                    ? "border-primary/30 bg-primary/5 text-foreground"
                    : "border-border bg-muted/30 text-muted-foreground"
                )}
              >
                <span>{slot.label}</span>
                {hasFile ? (
                  <CheckCircle2 className="size-3.5 text-primary" />
                ) : (
                  <X className="size-3.5" />
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onBack}
          disabled={isSubmitting}
          className="rounded-lg"
        >
          <ArrowLeft />
          Back to photos
        </Button>
        <Button
          size="lg"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-primary"
        >
          {isSubmitting ? <Spinner /> : <CheckCircle2 />}
          {isSubmitting ? "Registering…" : "Register vehicle"}
        </Button>
      </div>
    </>
  )
}

function SummaryRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm text-foreground",
          mono && "font-mono tracking-wider",
          !value && "text-muted-foreground"
        )}
      >
        {value || "—"}
      </dd>
    </div>
  )
}

// ── Right rail ──────────────────────────────────────────────────────────────
function LivePreview({ form }: { form: FormState }) {
  const tier = weightTierForKg(form.weightKg)
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        Live preview
      </p>
      <div className="mt-3 overflow-hidden rounded-lg">
        <VehicleIllustration
          axles={form.axles || 4}
          size="lg"
          hatched
          className="aspect-[16/8] h-auto"
        />
      </div>
      <p className="mt-3 font-mono text-base font-semibold tracking-wider text-foreground">
        {form.plate || "— — — — — —"}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {[form.makeModel || "Vehicle", form.year, `${form.axles || "—"} axles`]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="mt-4 rounded-lg bg-muted/40 p-3">
        <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          Estimated daily charge
        </p>
        {tier ? (
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {formatMzn(tier.mznPerDay)}{" "}
            <span className="text-sm font-medium text-muted-foreground">
              MZN/day
            </span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Enter a weight ≥ 8,000 kg.
          </p>
        )}
        {tier && (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Class {tier.label} · capped at 20,000 MZN/month per UC-004 BR-A3.
          </p>
        )}
      </div>
    </div>
  )
}

function SourceVerifiedNote() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-secondary/40 bg-accent/60 p-4">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
      <div>
        <p className="text-sm font-semibold text-foreground">
          Your data is verified at source
        </p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Plate, VIN and engine number are pulled from MVR and locked. To change
          them, update your logbook with MVR first.
        </p>
      </div>
    </div>
  )
}
