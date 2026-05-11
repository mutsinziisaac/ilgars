import { useEffect, useMemo, useState } from "react"
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
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { VehicleIllustration } from "@/components/fleet/vehicle-illustration"
import {
  VerticalStepper,
  type Step,
} from "@/components/fleet/vertical-stepper"
import {
  WEIGHT_TIERS,
  formatMzn,
  mvrLookup,
  normalisePlate,
  plateExists,
  tierMidpoint,
  weightTierForKg,
  type WeightTier,
} from "@/lib/fleet"
import { cn } from "@/lib/utils"

type StepKey = "logbook" | "details" | "photos" | "review"

const STEPS: readonly Step<StepKey>[] = [
  { key: "logbook", label: "Logbook (MVR)", description: "Pull from registry" },
  { key: "details", label: "Vehicle details", description: "Class · weight · usage" },
  { key: "photos", label: "Photos", description: "6 angles, JPEG/PNG ≤ 5 MB" },
  { key: "review", label: "Review & submit", description: "Confirm & register" },
]

const STEP_INDEX: Record<StepKey, number> = {
  logbook: 0,
  details: 1,
  photos: 2,
  review: 3,
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
  photos: {},
  photoErrors: {},
}

const PHOTO_MAX_BYTES = 5 * 1024 * 1024

export default function VehicleNew() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const stepParam = (params.get("step") ?? "logbook") as StepKey
  const step: StepKey = STEP_INDEX[stepParam] !== undefined ? stepParam : "logbook"
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
    if (i === 0) navigate(returnTo ?? "/fleet")
    else goTo(STEPS[i - 1].key)
  }

  const handleSubmit = () => {
    toast.success(`Vehicle ${form.plate} registered · ref TRK-100184-09`, {
      description: "Logbook synced via MVR. Ready to assign drivers.",
    })
    navigate(returnTo ?? "/fleet")
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
          <LogbookStep form={form} setForm={setForm} onContinue={() => goTo("details")} />
        )}
        {step === "details" && (
          <DetailsStep
            form={form}
            setForm={setForm}
            onBack={back}
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
          <ReviewStep form={form} onBack={back} onSubmit={handleSubmit} />
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
      <Button variant="outline" size="lg" onClick={onBack} className="rounded-lg">
        <ArrowLeft />
        {backLabel}
      </Button>
      <Button size="lg" onClick={onContinue} disabled={disabled} className="rounded-lg">
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
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [duplicate, setDuplicate] = useState(false)

  const lookup = async () => {
    const norm = normalisePlate(plateInput)
    if (!norm) return
    if (plateExists(norm)) {
      setDuplicate(true)
      setNotFound(false)
      return
    }
    setDuplicate(false)
    setLoading(true)
    setNotFound(false)
    const result = await mvrLookup(norm)
    setLoading(false)
    if (result.kind === "not-found") {
      setNotFound(true)
      return
    }
    setForm({
      ...INITIAL_STATE,
      plate: result.data.plate,
      logbookRef: result.data.logbookRef,
      makeModel: result.data.makeModel,
      year: String(result.data.year),
      chassisVin: result.data.chassisVin,
      engineNumber: result.data.engineNumber,
      axles: result.data.axles,
      weightKg: result.data.weightKg,
      usageType: "cargo",
      mvrLocked: true,
      photos: {},
      photoErrors: {},
    })
    onContinue()
  }

  const startManual = () => {
    setForm({ ...INITIAL_STATE, plate: normalisePlate(plateInput), mvrLocked: false })
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
              }}
              placeholder="e.g. AKM 902 MC"
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
            Enter the registered plate. We'll fetch the canonical record from MVR; if it isn't there
            yet you can register manually.
          </FieldDescription>
          {duplicate && (
            <FieldError>
              A vehicle with plate {normalisePlate(plateInput)} is already in your fleet.
            </FieldError>
          )}
        </Field>

        {notFound && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-secondary/40 bg-accent/60 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">No MVR record found</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                We couldn't match {normalisePlate(plateInput)} in MVR. You can still register the
                vehicle manually — fields will be unlocked on the next step.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={startManual} className="rounded-md">
              Continue manually
            </Button>
          </div>
        )}
      </FieldGroup>
    </Card>
  )
}

// ── Step: Vehicle details ───────────────────────────────────────────────────
function DetailsStep({
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
  const [weightInput, setWeightInput] = useState(
    form.weightKg ? String(form.weightKg) : ""
  )
  const [touched, setTouched] = useState(false)
  const tier = useMemo(() => weightTierForKg(form.weightKg), [form.weightKg])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const setWeightKg = (kg: number) => {
    setWeightInput(kg ? String(kg) : "")
    update("weightKg", kg)
  }

  const validationError = !form.weightKg
    ? "Enter the vehicle's gross weight (kg)."
    : form.weightKg < 1_000
      ? "Weight must be at least 1,000 kg."
      : form.weightKg > 80_000
        ? "Weight must be at most 80,000 kg."
        : null

  const canContinue = !validationError && form.axles >= 2 && form.makeModel.trim().length > 0

  const handleContinue = () => {
    setTouched(true)
    if (canContinue) onContinue()
  }

  return (
    <>
      {form.mvrLocked && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <CheckCircle2 className="size-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Logbook verified via MVR API</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Logbook {form.logbookRef} matched to plate {form.plate}. Fields below were prefilled —
              verify and adjust where needed.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-md text-primary hover:bg-primary/10">
            Re-fetch
          </Button>
        </div>
      )}

      <Card>
        <SectionHeader eyebrow="Vehicle identity" />
        <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LockedField
            id="plate"
            label="Number plate"
            mvr={form.mvrLocked}
            value={form.plate}
            onChange={(v) => update("plate", v.toUpperCase())}
            mono
          />
          <LockedField
            id="logbook"
            label="Logbook reference"
            mvr={form.mvrLocked}
            value={form.logbookRef}
            onChange={(v) => update("logbookRef", v)}
            mono
          />
          <LockedField
            id="model"
            label="Make & model"
            mvr={form.mvrLocked}
            value={form.makeModel}
            onChange={(v) => update("makeModel", v)}
          />
          <LockedField
            id="year"
            label="Year of manufacture"
            mvr={form.mvrLocked}
            value={form.year}
            onChange={(v) => update("year", v.replace(/[^0-9]/g, "").slice(0, 4))}
          />
          <LockedField
            id="vin"
            label="Chassis number (VIN)"
            mvr={form.mvrLocked}
            value={form.chassisVin}
            onChange={(v) => update("chassisVin", v.toUpperCase())}
            mono
          />
          <LockedField
            id="engine"
            label="Engine number"
            mvr={form.mvrLocked}
            value={form.engineNumber}
            onChange={(v) => update("engineNumber", v.toUpperCase())}
            mono
          />
        </FieldGroup>
      </Card>

      <Card>
        <SectionHeader
          eyebrow="RUC classification"
          description="Determines applicable tariff per UC-004 (Circulation Licence Fees)"
          trailing={
            <span className="rounded-full bg-sidebar/10 px-2.5 py-0.5 text-[11px] font-medium text-sidebar">
              Affects pricing
            </span>
          }
        />

        <Field>
          <FieldLabel>Number of axles</FieldLabel>
          <div className="grid grid-cols-5 gap-2">
            {[2, 3, 4, 5, 6].map((n) => {
              const selected = form.axles === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => update("axles", n)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    selected
                      ? "border-sidebar bg-sidebar text-sidebar-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  {n} axles
                </button>
              )
            })}
          </div>
        </Field>

        <Field data-invalid={touched && !!validationError ? "true" : undefined}>
          <FieldLabel htmlFor="weight-input">Gross weight (kg) — drives tariff bracket</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="weight-input"
              inputMode="numeric"
              value={weightInput}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "")
                setWeightInput(raw)
                update("weightKg", raw === "" ? 0 : Number(raw))
              }}
              onBlur={() => setTouched(true)}
              placeholder="e.g. 32500"
              className="font-mono text-sm tabular-nums"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>kg</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <div className="grid grid-cols-5 gap-2 pt-1">
            {WEIGHT_TIERS.map((t) => {
              const active = tier?.key === t.key
              return (
                <WeightChip
                  key={t.key}
                  tier={t}
                  active={active}
                  onClick={() => setWeightKg(tierMidpoint(t))}
                />
              )
            })}
          </div>
          {touched && validationError ? (
            <FieldError>{validationError}</FieldError>
          ) : (
            form.weightKg > 0 &&
            form.weightKg < 8_000 && (
              <FieldDescription>
                Note: below the 8,000 kg RUC threshold — vehicle may be exempt.
              </FieldDescription>
            )
          )}
        </Field>

        <Field>
          <FieldLabel>Usage type</FieldLabel>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <UsageCard
              id="cargo"
              title="Cargo truck"
              subtitle="Standard freight"
              selected={form.usageType === "cargo"}
              onSelect={() => update("usageType", "cargo")}
            />
            <UsageCard
              id="agricultural"
              title="Agricultural transit"
              subtitle="1,000 MZN/day flat"
              selected={form.usageType === "agricultural"}
              onSelect={() => update("usageType", "agricultural")}
            />
            <UsageCard
              id="special"
              title="Special permit"
              subtitle="Case-by-case"
              selected={form.usageType === "special"}
              onSelect={() => update("usageType", "special")}
            />
          </div>
        </Field>
      </Card>

      <Footer
        backLabel="Back to logbook"
        continueLabel="Continue to photos"
        onBack={onBack}
        onContinue={handleContinue}
        disabled={touched && !canContinue}
      />
    </>
  )
}

function LockedField({
  id,
  label,
  mvr,
  value,
  onChange,
  mono = false,
}: {
  id: string
  label: string
  mvr: boolean
  value: string
  onChange: (v: string) => void
  mono?: boolean
}) {
  return (
    <Field>
      <div className="flex items-center justify-between">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {mvr && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-primary uppercase">
            MVR <CheckCircle2 className="size-3" strokeWidth={3} />
          </span>
        )}
      </div>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={mvr}
        className={cn(
          mono && "font-mono tracking-wider",
          mvr && "bg-muted/50 text-foreground"
        )}
      />
    </Field>
  )
}

function WeightChip({
  tier,
  active,
  onClick,
}: {
  tier: WeightTier
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card hover:border-primary/30 hover:bg-primary/5"
      )}
    >
      <span
        className={cn(
          "text-xs font-semibold",
          active ? "text-primary" : "text-foreground"
        )}
      >
        {tier.label}
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {formatMzn(tier.mznPerDay)} MZN/d
      </span>
    </button>
  )
}

function UsageCard({
  id,
  title,
  subtitle,
  selected,
  onSelect,
}: {
  id: string
  title: string
  subtitle: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        selected
          ? "border-primary bg-primary/5"
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
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
      <input id={id} type="radio" className="sr-only" checked={selected} readOnly />
    </button>
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
        backLabel="Back to details"
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
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
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
            <span className="text-[11px] text-muted-foreground">Click to upload</span>
            <span className="text-[10px] text-muted-foreground/70">JPEG/PNG · ≤ 5 MB</span>
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
}: {
  form: FormState
  onBack: () => void
  onSubmit: () => void
}) {
  const tier = weightTierForKg(form.weightKg)

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
        <Button variant="outline" size="lg" onClick={onBack} className="rounded-lg">
          <ArrowLeft />
          Back to photos
        </Button>
        <Button size="lg" onClick={onSubmit} className="rounded-lg bg-primary">
          <CheckCircle2 />
          Register vehicle
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
            <span className="text-sm font-medium text-muted-foreground">MZN/day</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Enter a weight ≥ 8,000 kg.</p>
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
        <p className="text-sm font-semibold text-foreground">Your data is verified at source</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Plate, VIN and engine number are pulled from MVR and locked. To change them, update your
          logbook with MVR first.
        </p>
      </div>
    </div>
  )
}


