import { Fragment, useMemo, useState, type FormEvent } from "react"
import { endOfDay, startOfDay } from "date-fns"
import type { DateRange } from "react-day-picker"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Ban,
  CalendarIcon,
  Check,
  Clock,
  CreditCard,
  MoveHorizontal,
  FileText,
  MapPin,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Search,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"

import { useAuth } from "@/components/auth/auth-context"
import { PermitCertificateDialog } from "@/components/permits/permit-certificate-dialog"
import { PermitPaymentDialog } from "@/components/permits/permit-payment-dialog"
import { PermitMap } from "@/components/permits/permit-map"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { getApiErrorMessage } from "@/lib/api"
import { formatMzn } from "@/lib/fleet"
import {
  createRoadClosurePermit,
  getMunicipalRoute,
  listRoadClosurePermits,
  listRoadClosureRoutes,
  MUNICIPALITY_ID,
  type MunicipalRoute,
  type RoadClosurePermit,
  type RoadClosurePurpose,
} from "@/lib/trips-api"
import { cn } from "@/lib/utils"

type ClosureScope = "FULL" | "PARTIAL"

type RoadClosureForm = {
  purpose: RoadClosurePurpose
  closureType: ClosureScope
  requestedStartAt: string
  requestedEndAt: string
  conditions: string
}

type GeoJsonLineStringFeature = {
  type: "Feature"
  geometry?: {
    type?: string
    coordinates?: unknown
  }
}

const PURPOSES: RoadClosurePurpose[] = [
  "CONSTRUCTION",
  "FILMING",
  "SPORTING_EVENT",
  "PARADE",
  "PRIVATE_EVENT",
  "PROTOCOL",
  "OTHER",
]

const PERMIT_STATUSES = [
  "PENDING_ADMIN_APPROVAL",
  "APPROVED_PENDING_PAYMENT",
  "ISSUED",
  "REJECTED",
] as const

type PermitStatusKey = (typeof PERMIT_STATUSES)[number]

function permitStatusLabel(status: string | undefined, t: TFunction) {
  const key = (status ?? "").toUpperCase()
  if ((PERMIT_STATUSES as readonly string[]).includes(key)) {
    return t(`permits.statuses.${key}`)
  }
  return formatPurpose(status, t)
}

function applicationDate(permit: RoadClosurePermit): Date | null {
  const raw =
    (permit.createdAt as string | undefined) ?? permit.requestedStartAt
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function initialForm(): RoadClosureForm {
  return {
    purpose: "CONSTRUCTION",
    closureType: "FULL",
    requestedStartAt: "",
    requestedEndAt: "",
    conditions: "",
  }
}

function routeLabel(route: MunicipalRoute) {
  return (
    route.name ?? route.routeName ?? route.code ?? route.routeCode ?? route.id
  )
}

function routeCode(route: MunicipalRoute) {
  return route.code ?? route.routeCode ?? route.id
}

function routeDistance(route: MunicipalRoute | undefined) {
  return typeof route?.distanceKm === "number" &&
    Number.isFinite(route.distanceKm)
    ? route.distanceKm
    : null
}

function formatRoadType(value: unknown, t: TFunction) {
  if (typeof value !== "string" || !value.trim()) return t("common.notRecorded")
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatPurpose(
  value: RoadClosurePurpose | string | undefined,
  t: TFunction
) {
  if (!value) return t("common.notRecorded")
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function pad2(value: number) {
  return value < 10 ? `0${value}` : `${value}`
}

function formatLocalDateValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`
}

function parseLocalDateTime(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function timePart(value: string) {
  const date = parseLocalDateTime(value)
  if (!date) return ""
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function combineDateAndTime(date: Date, time: string) {
  return `${formatLocalDateValue(date)}T${time || "08:00"}`
}

function toIsoFromLocalInput(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

function parseRouteSegment(
  route: MunicipalRoute | undefined
): [number, number][] {
  const raw = route?.geoJson
  if (!raw) return []

  let parsed: unknown = raw
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
  }

  const feature = parsed as GeoJsonLineStringFeature
  const coordinates = feature.geometry?.coordinates
  if (feature.type !== "Feature" || feature.geometry?.type !== "LineString") {
    return []
  }
  if (!Array.isArray(coordinates)) return []

  return coordinates.flatMap((point): [number, number][] => {
    if (!Array.isArray(point) || point.length < 2) return []
    const lng = Number(point[0])
    const lat = Number(point[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
    return [[lat, lng]]
  })
}

function randomDigits(length: number) {
  let out = ""
  for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 10)
  return out
}

function randomApplicantName() {
  return `Applicant-${randomDigits(6)}`
}

function randomApplicantPhone() {
  return `+2587${randomDigits(8)}`
}

function isValidRequest(form: RoadClosureForm, routeId: string | null) {
  if (!routeId) return false
  if (!form.requestedStartAt || !form.requestedEndAt) return false
  const start = new Date(form.requestedStartAt).getTime()
  const end = new Date(form.requestedEndAt).getTime()
  return Number.isFinite(start) && Number.isFinite(end) && end > start
}

type StatusTone = "default" | "secondary" | "destructive"

function statusTone(status: string | undefined): StatusTone {
  const normalized = status ?? "PENDING_ADMIN_APPROVAL"
  if (normalized === "REJECTED") return "destructive"
  if (normalized === "ISSUED" || normalized === "APPROVED") return "default"
  return "secondary"
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  )
}

function DateTimeField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const selectedDate = parseLocalDateTime(value)
  const selectedTime = timePart(value)

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn(
                "h-10 justify-start gap-2 px-3 text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="size-4" />
              {selectedDate
                ? new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                  }).format(selectedDate)
                : label}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate ?? undefined}
              onSelect={(date) => {
                if (!date) return
                onChange(combineDateAndTime(date, selectedTime))
              }}
            />
          </PopoverContent>
        </Popover>
        <Input
          type="time"
          value={selectedTime}
          onChange={(event) => {
            const date = selectedDate ?? new Date()
            onChange(combineDateAndTime(date, event.target.value))
          }}
          aria-label={label}
          className="h-10"
        />
      </div>
    </Field>
  )
}

function formatDateShort(value: string | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  }).format(date)
}

const STATUS_DOT_CLASSES: Record<StatusTone, string> = {
  default: "bg-primary shadow-[0_0_0_3px_var(--color-primary)/15]",
  secondary: "bg-muted-foreground/50",
  destructive: "bg-destructive shadow-[0_0_0_3px_var(--color-destructive)/15]",
}

const STATUS_TEXT_CLASSES: Record<StatusTone, string> = {
  default: "text-primary",
  secondary: "text-muted-foreground",
  destructive: "text-destructive",
}

const STATUS_BADGE_CLASSES: Record<StatusTone, string> = {
  default: "bg-primary/10 text-primary ring-primary/20",
  secondary: "bg-muted text-muted-foreground ring-border",
  destructive: "bg-destructive/10 text-destructive ring-destructive/20",
}

function PermitCard({
  permit,
  onSelect,
}: {
  permit: RoadClosurePermit
  onSelect: (permit: RoadClosurePermit) => void
}) {
  const { t } = useTranslation()
  const route = permit.route as MunicipalRoute | undefined
  const invoice = permit.invoice ?? null
  const amount =
    typeof invoice?.amount === "number"
      ? invoice.amount
      : typeof invoice?.totalAmount === "number"
        ? invoice.totalAmount
        : null
  const tone = statusTone(permit.status)
  const start = formatDateShort(permit.requestedStartAt)
  const end = formatDateShort(permit.requestedEndAt)
  const window =
    start && end
      ? `${start} → ${end}`
      : (start ?? end ?? t("common.notRecorded"))
  const statusLabel = formatPurpose(permit.status ?? "PENDING_ADMIN_APPROVAL", t)

  return (
    <button
      type="button"
      onClick={() => onSelect(permit)}
      className="group relative flex w-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all outline-none hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)] focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
          <span className="text-foreground/70">Permit</span>
          <span className="text-foreground">{permit.id}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("size-1.5 rounded-full", STATUS_DOT_CLASSES[tone])}
          />
          <span
            className={cn(
              "text-[11px] font-semibold tracking-wide",
              STATUS_TEXT_CLASSES[tone]
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <h3 className="text-lg leading-tight font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
        {route ? routeLabel(route) : t("common.notRecorded")}
      </h3>

      <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
        <Meta
          label={t("permits.roadClosure.purpose")}
          value={formatPurpose(permit.purpose, t)}
        />
        <Meta label={t("permits.roadClosure.window")} value={window} />
        <Meta
          label={t("permits.roadClosure.applicantName")}
          value={permit.applicantName ?? t("common.notRecorded")}
        />
        <Meta
          label={t("common.total")}
          value={
            amount === null
              ? "—"
              : `${formatMzn(amount)} ${invoice?.currency ?? "MZN"}`
          }
        />
      </div>
    </button>
  )
}

function StatusFlow({
  status,
  t,
}: {
  status: string | undefined
  t: TFunction
}) {
  const key = (status ?? "").toUpperCase()
  const rejected = key === "REJECTED"
  const issued = key === "ISSUED"
  const steps = [
    { key: "PENDING_ADMIN_APPROVAL", label: t("permits.flow.review") },
    { key: "APPROVED_PENDING_PAYMENT", label: t("permits.flow.payment") },
    { key: "ISSUED", label: t("permits.flow.issued") },
  ]
  const matched = steps.findIndex((step) => step.key === key)
  const currentIndex = rejected || matched < 0 ? 0 : matched
  const tone = statusTone(status)

  return (
    <>
      {/* Mobile: compact status badge */}
      <span
        className={cn(
          "inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset md:hidden",
          STATUS_BADGE_CLASSES[tone]
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            STATUS_DOT_CLASSES[tone]
          )}
        />
        {permitStatusLabel(status, t)}
      </span>

      {/* Desktop: status flow */}
      <div className="hidden items-start md:flex">
        {steps.map((step, index) => {
          const complete =
            !rejected && (index < currentIndex || (index === currentIndex && issued))
          const current = !rejected && index === currentIndex && !issued
          const stepRejected = rejected && index === 0
          const upcoming = !complete && !current && !stepRejected
          const connectorActive = !rejected && currentIndex >= index

          return (
            <Fragment key={step.key}>
              {index > 0 && (
                <span
                  aria-hidden
                  className="relative mt-[13px] h-0.5 w-7 overflow-hidden rounded-full bg-border lg:w-12"
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500",
                      connectorActive ? "w-full" : "w-0"
                    )}
                  />
                </span>
              )}
              <div className="flex w-16 flex-col items-center gap-2">
                <span className="relative flex size-7 items-center justify-center">
                  <span
                    className={cn(
                      "relative flex size-7 items-center justify-center rounded-full text-[11px] font-semibold ring-1 ring-inset transition-all duration-300",
                      complete &&
                        "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground ring-primary/40 shadow-sm shadow-primary/30",
                      current &&
                        "bg-primary/10 text-primary ring-2 ring-primary shadow-sm shadow-primary/20",
                      stepRejected &&
                        "bg-gradient-to-br from-destructive to-destructive/80 text-white ring-destructive/40 shadow-sm shadow-destructive/30",
                      upcoming && "bg-muted text-muted-foreground/50 ring-border"
                    )}
                  >
                    {complete ? (
                      <Check className="size-3.5" strokeWidth={3} />
                    ) : stepRejected ? (
                      <X className="size-3.5" strokeWidth={3} />
                    ) : (
                      index + 1
                    )}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold tracking-wide whitespace-nowrap transition-colors",
                    complete && "text-primary",
                    current && "text-foreground",
                    stepRejected && "text-destructive",
                    upcoming && "text-muted-foreground/60"
                  )}
                >
                  {stepRejected ? t("permits.flow.rejected") : step.label}
                </span>
              </div>
            </Fragment>
          )
        })}
      </div>
    </>
  )
}

function ApplicationRow({
  permit,
  onPay,
}: {
  permit: RoadClosurePermit
  onPay: (permit: RoadClosurePermit) => void
}) {
  const { t } = useTranslation()
  const route = permit.route as MunicipalRoute | undefined
  const start = formatDateShort(permit.requestedStartAt)
  const end = formatDateShort(permit.requestedEndAt)
  const window =
    start && end
      ? `${start} → ${end}`
      : (start ?? end ?? t("common.notRecorded"))
  const date = applicationDate(permit)
  const dateLabel = date
    ? new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date)
    : t("common.notRecorded")
  const invoice = permit.invoice ?? null
  const amount =
    typeof invoice?.amount === "number"
      ? invoice.amount
      : typeof invoice?.totalAmount === "number"
        ? invoice.totalAmount
        : null
  const canPay = (permit.status ?? "").toUpperCase() === "APPROVED_PENDING_PAYMENT"

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
          <span className="text-foreground/70">Permit</span>
          <span className="text-foreground">{permit.id}</span>
        </div>
        <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
          {route ? routeLabel(route) : t("common.notRecorded")}
        </h3>
        <p className="truncate text-xs text-muted-foreground">
          {formatPurpose(permit.purpose, t)} · {window}
        </p>
      </div>
      <StatusFlow status={permit.status} t={t} />
      <div className="flex shrink-0 items-center gap-4 md:gap-6">
        {canPay && (
          <Button
            type="button"
            size="sm"
            onClick={() => onPay(permit)}
            className="gap-1.5 rounded-lg"
          >
            <CreditCard className="size-3.5" />
            {t("permits.payNow")}
            {amount !== null && (
              <span className="font-mono">· {formatMzn(amount)}</span>
            )}
          </Button>
        )}
        <div className="text-right">
          <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            {t("permits.appDate")}
          </p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {dateLabel}
          </p>
        </div>
      </div>
    </div>
  )
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{t("permits.roadClosure.pendingFailed")}</AlertTitle>
      <AlertDescription>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="mt-2 gap-2"
        >
          <RefreshCw className="size-3.5" />
          {t("common.retry")}
        </Button>
      </AlertDescription>
    </Alert>
  )
}

function LoadingPanel() {
  const { t } = useTranslation()
  return (
    <div className="flex h-48 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-sm text-muted-foreground">
      <Spinner />
      {t("permits.roadClosure.loadingPending")}
    </div>
  )
}

export default function Permits() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const creating = params.get("mode") === "new"
  const [query, setQuery] = useState("")
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [selectedPermit, setSelectedPermit] = useState<RoadClosurePermit | null>(
    null
  )
  const [payingPermit, setPayingPermit] = useState<RoadClosurePermit | null>(
    null
  )
  const [appSearch, setAppSearch] = useState("")
  const [appStatus, setAppStatus] = useState<"ALL" | PermitStatusKey>("ALL")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [form, setForm] = useState<RoadClosureForm>(() => initialForm())

  const routesQuery = useQuery({
    queryKey: ["road-closure-routes", MUNICIPALITY_ID],
    queryFn: () => listRoadClosureRoutes(MUNICIPALITY_ID),
    enabled: creating && !!MUNICIPALITY_ID,
  })

  const reviewQuery = useQuery({
    queryKey: ["road-closure-permits", MUNICIPALITY_ID, "PENDING_ADMIN_APPROVAL"],
    queryFn: () =>
      listRoadClosurePermits(MUNICIPALITY_ID, "PENDING_ADMIN_APPROVAL"),
    enabled: !creating && !!MUNICIPALITY_ID,
  })
  const paymentQuery = useQuery({
    queryKey: [
      "road-closure-permits",
      MUNICIPALITY_ID,
      "APPROVED_PENDING_PAYMENT",
    ],
    queryFn: () =>
      listRoadClosurePermits(MUNICIPALITY_ID, "APPROVED_PENDING_PAYMENT"),
    enabled: !creating && !!MUNICIPALITY_ID,
  })
  const issuedQuery = useQuery({
    queryKey: ["road-closure-permits", MUNICIPALITY_ID, "ISSUED"],
    queryFn: () => listRoadClosurePermits(MUNICIPALITY_ID, "ISSUED"),
    enabled: !creating && !!MUNICIPALITY_ID,
  })
  const rejectedQuery = useQuery({
    queryKey: ["road-closure-permits", MUNICIPALITY_ID, "REJECTED"],
    queryFn: () => listRoadClosurePermits(MUNICIPALITY_ID, "REJECTED"),
    enabled: !creating && !!MUNICIPALITY_ID,
  })
  const applicationQueries = [
    reviewQuery,
    paymentQuery,
    issuedQuery,
    rejectedQuery,
  ] as const

  const detailQuery = useQuery({
    queryKey: ["municipal-route-detail", selectedRouteId],
    queryFn: () => getMunicipalRoute(selectedRouteId!),
    enabled: creating && !!selectedRouteId,
  })

  const routes = useMemo(() => routesQuery.data ?? [], [routesQuery.data])
  const filteredRoutes = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return routes
    return routes.filter((route) =>
      `${routeLabel(route)} ${routeCode(route)}`.toLowerCase().includes(needle)
    )
  }, [query, routes])

  const selectedRoute =
    detailQuery.data ?? routes.find((route) => route.id === selectedRouteId)
  const segment = useMemo(
    () => parseRouteSegment(selectedRoute),
    [selectedRoute]
  )
  const distanceKm = routeDistance(selectedRoute)

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedRouteId)
        throw new Error(t("permits.roadClosure.routeRequired"))
      const applicantName =
        user.username?.trim() ||
        user.displayName?.trim() ||
        randomApplicantName()
      return createRoadClosurePermit({
        municipalityId: MUNICIPALITY_ID,
        routeId: selectedRouteId,
        purpose: form.purpose,
        requestedStartAt: toIsoFromLocalInput(form.requestedStartAt),
        requestedEndAt: toIsoFromLocalInput(form.requestedEndAt),
        applicantName,
        applicantPhone: randomApplicantPhone(),
        ...(form.conditions.trim()
          ? { conditions: form.conditions.trim() }
          : {}),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["road-closure-permits", MUNICIPALITY_ID],
      })
      toast.success(t("permits.roadClosure.submittedToast"), {
        description: t("permits.roadClosure.submittedDescription"),
      })
      navigate("/portal/permits?tab=applications")
    },
    onError: (error) => {
      toast.error(t("permits.roadClosure.submitFailed"), {
        description: getApiErrorMessage(error, t("landing.tryAgain")),
      })
    },
  })

  const canSubmit =
    !!MUNICIPALITY_ID &&
    isValidRequest(form, selectedRouteId) &&
    !createMutation.isPending

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    createMutation.mutate()
  }

  const issuedPermits = useMemo(
    () => issuedQuery.data ?? [],
    [issuedQuery.data]
  )

  const allApplications = useMemo(() => {
    const map = new Map<string, RoadClosurePermit>()
    for (const list of [
      reviewQuery.data,
      paymentQuery.data,
      issuedQuery.data,
      rejectedQuery.data,
    ]) {
      for (const permit of list ?? []) map.set(permit.id, permit)
    }
    return [...map.values()].sort(
      (a, b) =>
        (applicationDate(b)?.getTime() ?? 0) -
        (applicationDate(a)?.getTime() ?? 0)
    )
  }, [reviewQuery.data, paymentQuery.data, issuedQuery.data, rejectedQuery.data])

  const filteredApplications = useMemo(() => {
    const needle = appSearch.trim().toLowerCase()
    const from = dateRange?.from ? startOfDay(dateRange.from) : null
    const to = dateRange?.to
      ? endOfDay(dateRange.to)
      : dateRange?.from
        ? endOfDay(dateRange.from)
        : null
    return allApplications.filter((permit) => {
      if (
        appStatus !== "ALL" &&
        (permit.status ?? "").toUpperCase() !== appStatus
      ) {
        return false
      }
      if (needle) {
        const route = permit.route as MunicipalRoute | undefined
        const haystack = [
          permit.id,
          route ? routeLabel(route) : "",
          permit.purpose,
          permit.applicantName,
          permit.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      if (from || to) {
        const date = applicationDate(permit)
        if (!date) return false
        if (from && date.getTime() < from.getTime()) return false
        if (to && date.getTime() > to.getTime()) return false
      }
      return true
    })
  }, [allApplications, appSearch, appStatus, dateRange])

  const appsLoading = applicationQueries.some((q) => q.isLoading)
  const appsAllErrored = applicationQueries.every((q) => q.isError)
  const hasDateFilter = !!dateRange?.from
  const dateRangeLabel = (() => {
    if (!dateRange?.from) return t("permits.allDates")
    const fmt = (date: Date) =>
      new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "short",
      }).format(date)
    return dateRange.to
      ? `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`
      : fmt(dateRange.from)
  })()

  if (!creating) {
    return (
      <div className="space-y-6 pb-16">
        {!MUNICIPALITY_ID && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>{t("landing.municipalityMissing")}</AlertTitle>
            <AlertDescription>
              {t("permits.roadClosure.municipalityMissingDescription")}
            </AlertDescription>
          </Alert>
        )}

        <Tabs
          defaultValue={
            params.get("tab") === "applications" ? "applications" : "permits"
          }
          className="gap-5"
        >
          <TabsList variant="line" className="border-b border-border pb-1">
            <TabsTrigger value="permits">
              <BadgeCheck />
              {t("permits.myPermits")}
              <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums">
                {issuedPermits.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="applications">
              <FileText />
              {t("permits.myApplications")}
              <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums">
                {allApplications.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="permits" className="mt-0 space-y-4">
            {issuedQuery.isError ? (
              <ErrorPanel onRetry={() => void issuedQuery.refetch()} />
            ) : issuedQuery.isLoading && issuedPermits.length === 0 ? (
              <LoadingPanel />
            ) : issuedPermits.length === 0 ? (
              <Card>
                <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <BadgeCheck className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      {t("permits.myPermitsEmptyTitle")}
                    </h2>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      {t("permits.myPermitsEmptyDescription")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => navigate("/portal/permits?mode=new")}
                    className="gap-2 rounded-lg bg-sidebar text-sidebar-foreground hover:bg-sidebar/90"
                  >
                    <Plus className="size-4" />
                    {t("shell.newApplication")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {issuedPermits.map((permit) => (
                  <PermitCard
                    key={permit.id}
                    permit={permit}
                    onSelect={setSelectedPermit}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="applications" className="mt-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
              <div className="relative min-w-48 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={appSearch}
                  onChange={(event) => setAppSearch(event.target.value)}
                  placeholder={t("permits.applicationsSearch")}
                  className="h-9 rounded-lg border-border bg-background pl-8 text-sm shadow-none"
                />
              </div>
              <Select
                value={appStatus}
                onValueChange={(value) =>
                  setAppStatus(value as "ALL" | PermitStatusKey)
                }
              >
                <SelectTrigger className="h-9 w-44 rounded-lg border-border bg-background text-sm shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("permits.statusAll")}</SelectItem>
                  {PERMIT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`permits.statuses.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-9 justify-start gap-2 rounded-lg px-3 text-sm font-normal",
                      !hasDateFilter && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="size-4" />
                    {dateRangeLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0">
                  <Calendar
                    mode="range"
                    numberOfMonths={1}
                    selected={dateRange}
                    onSelect={setDateRange}
                  />
                  {hasDateFilter && (
                    <div className="border-t border-border p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setDateRange(undefined)}
                      >
                        {t("permits.clearDates")}
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {appsAllErrored ? (
              <ErrorPanel
                onRetry={() =>
                  applicationQueries.forEach((query) => void query.refetch())
                }
              />
            ) : appsLoading && allApplications.length === 0 ? (
              <LoadingPanel />
            ) : allApplications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                {t("permits.noApplicationsYet")}
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  {t("permits.noApplicationsTitle")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("permits.noApplicationsDescription")}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredApplications.map((permit) => (
                  <ApplicationRow
                    key={permit.id}
                    permit={permit}
                    onPay={setPayingPermit}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <PermitCertificateDialog
          permit={selectedPermit}
          onOpenChange={(open) => {
            if (!open) setSelectedPermit(null)
          }}
        />
        <PermitPaymentDialog
          permit={payingPermit}
          onOpenChange={(open) => {
            if (!open) setPayingPermit(null)
          }}
          onPaid={() => {
            void queryClient.invalidateQueries({
              queryKey: ["road-closure-permits", MUNICIPALITY_ID],
            })
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="outline" className="mt-1 gap-1.5">
          <Clock className="size-3" />
          {t("permits.roadClosure.pendingReview")}
        </Badge>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/portal/permits")}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          {t("permits.roadClosure.backToPermits")}
        </Button>
      </div>

      {!MUNICIPALITY_ID && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{t("landing.municipalityMissing")}</AlertTitle>
          <AlertDescription>
            {t("permits.roadClosure.municipalityMissingDescription")}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
        <Card className="self-start xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle>{t("permits.roadClosure.routesTitle")}</CardTitle>
            <CardDescription>
              {t("permits.roadClosure.routesDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("permits.roadClosure.routeSearch")}
                className="h-10 pl-8"
              />
            </div>

            {routesQuery.isError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>{t("permits.roadClosure.routesFailed")}</AlertTitle>
                <AlertDescription>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void routesQuery.refetch()}
                    className="mt-2 gap-2"
                  >
                    <RefreshCw className="size-3.5" />
                    {t("common.retry")}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {routesQuery.isLoading ? (
              <div className="flex h-56 items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                <Spinner />
                {t("permits.roadClosure.loadingRoutes")}
              </div>
            ) : (
              <ul className="max-h-[520px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {filteredRoutes.map((route) => {
                  const selected = selectedRouteId === route.id
                  return (
                    <li key={route.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRouteId(route.id)
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                          selected ? "bg-primary/5" : "hover:bg-muted/50"
                        )}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <RouteIcon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {routeLabel(route)}
                          </span>
                          <span className="block truncate font-mono text-[10px] text-muted-foreground">
                            {routeCode(route)}
                          </span>
                        </span>
                        {selected && <Badge>{t("common.selected")}</Badge>}
                      </button>
                    </li>
                  )
                })}
                {filteredRoutes.length === 0 && (
                  <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {t("permits.roadClosure.noRouteMatches")}
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle>
                    {t("permits.roadClosure.routeDetailTitle")}
                  </CardTitle>
                  <CardDescription>
                    {selectedRoute
                      ? routeLabel(selectedRoute)
                      : t("permits.roadClosure.selectRoutePrompt")}
                  </CardDescription>
                </div>
                {selectedRoute && (
                  <Badge
                    variant={
                      selectedRoute.active === false ? "outline" : "secondary"
                    }
                  >
                    {selectedRoute.active === false
                      ? t("permits.roadClosure.inactive")
                      : t("common.active")}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[280px] overflow-hidden rounded-xl border border-border bg-muted/20 sm:h-[360px]">
                {detailQuery.isFetching && !selectedRoute ? (
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Spinner />
                    {t("permits.roadClosure.loadingRouteDetail")}
                  </div>
                ) : (
                  <PermitMap
                    segment={segment}
                    interactive
                    emptyLabel={
                      selectedRoute
                        ? t("permits.roadClosure.noRouteGeometry")
                        : t("permits.roadClosure.noRouteSelected")
                    }
                  />
                )}
              </div>

              {detailQuery.isError && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>
                    {t("permits.roadClosure.routeDetailFailed")}
                  </AlertTitle>
                  <AlertDescription>
                    {t("permits.roadClosure.routeDetailFailedDescription")}
                  </AlertDescription>
                </Alert>
              )}

              {selectedRoute && (
                <div className="grid gap-3 md:grid-cols-4">
                  <Meta
                    label={t("permits.roadClosure.routeCode")}
                    value={routeCode(selectedRoute)}
                  />
                  <Meta
                    label={t("permits.roadClosure.roadType")}
                    value={formatRoadType(selectedRoute.roadType, t)}
                  />
                  <Meta
                    label={t("permits.roadClosure.distance")}
                    value={
                      distanceKm === null
                        ? t("common.notRecorded")
                        : t("permits.roadClosure.distanceKm", {
                            value: distanceKm.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            }),
                          })
                    }
                  />
                  <Meta
                    label={t("permits.roadClosure.points")}
                    value={t("permits.roadClosure.pointCount", {
                      count: segment.length,
                    })}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("permits.roadClosure.requestTitle")}</CardTitle>
              <CardDescription>
                {t("permits.roadClosure.requestDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={submit}>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="closure-purpose">
                      {t("permits.roadClosure.purpose")}
                    </FieldLabel>
                    <Select
                      value={form.purpose}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          purpose: value as RoadClosurePurpose,
                        }))
                      }
                    >
                      <SelectTrigger
                        id="closure-purpose"
                        className="h-10 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PURPOSES.map((purpose) => (
                          <SelectItem key={purpose} value={purpose}>
                            {t(`permits.roadClosure.purposes.${purpose}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <DateTimeField
                    id="closure-start"
                    label={t("permits.roadClosure.requestedStartAt")}
                    value={form.requestedStartAt}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        requestedStartAt: value,
                      }))
                    }
                  />
                  <DateTimeField
                    id="closure-end"
                    label={t("permits.roadClosure.requestedEndAt")}
                    value={form.requestedEndAt}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        requestedEndAt: value,
                      }))
                    }
                  />
                </div>

                <Field>
                  <FieldLabel>
                    {t("permits.roadClosure.closureType")}
                  </FieldLabel>
                  <FieldDescription>
                    {t("permits.roadClosure.closureTypeDescription")}
                  </FieldDescription>
                  <div
                    role="radiogroup"
                    className="mt-2 grid gap-3 sm:grid-cols-2"
                  >
                    {(
                      [
                        {
                          value: "FULL" as ClosureScope,
                          icon: Ban,
                          title: t("permits.roadClosure.closureFull"),
                          description: t(
                            "permits.roadClosure.closureFullDescription"
                          ),
                        },
                        {
                          value: "PARTIAL" as ClosureScope,
                          icon: MoveHorizontal,
                          title: t("permits.roadClosure.closurePartial"),
                          description: t(
                            "permits.roadClosure.closurePartialDescription"
                          ),
                        },
                      ] as const
                    ).map((option) => {
                      const selected = form.closureType === option.value
                      const Icon = option.icon
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              closureType: option.value,
                            }))
                          }
                          className={cn(
                            "group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground group-hover:text-foreground"
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-foreground">
                              {option.title}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border"
                            )}
                          >
                            {selected && <Check className="size-3" strokeWidth={3} />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </Field>

                <Field>
                  <FieldLabel htmlFor="closure-conditions">
                    {t("permits.roadClosure.conditions")}
                  </FieldLabel>
                  <Textarea
                    id="closure-conditions"
                    value={form.conditions}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        conditions: event.target.value,
                      }))
                    }
                    placeholder={t("permits.roadClosure.conditionsPlaceholder")}
                  />
                  <FieldDescription>
                    {t("permits.roadClosure.conditionsDescription")}
                  </FieldDescription>
                </Field>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {selectedRoute ? (
                        <MapPin className="size-4" />
                      ) : (
                        <FileText className="size-4" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {selectedRoute
                          ? routeLabel(selectedRoute)
                          : t("permits.roadClosure.noRouteSelected")}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {selectedRoute
                          ? t("permits.roadClosure.requestReviewNote")
                          : t("permits.roadClosure.selectRouteBeforeSubmit")}
                      </p>
                    </div>
                  </div>
                  <Button type="submit" disabled={!canSubmit} className="gap-2">
                    {createMutation.isPending && <Spinner />}
                    {t("permits.roadClosure.submitRequest")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
