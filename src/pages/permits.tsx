import { useMemo, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CalendarIcon,
  Check,
  Clock,
  CreditCard,
  FileText,
  MapPin,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"

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

type RoadClosureForm = {
  purpose: RoadClosurePurpose
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

type PermitPhaseKey = "review" | "payment" | "approved"

type PermitPhase = {
  key: PermitPhaseKey
  status: string
  labelKey: string
  shortLabelKey: string
  icon: typeof FileText
}

const PERMIT_PHASES: readonly PermitPhase[] = [
  {
    key: "review",
    status: "PENDING_ADMIN_APPROVAL",
    labelKey: "permits.roadClosure.phases.reviewLabel",
    shortLabelKey: "permits.roadClosure.phases.reviewShort",
    icon: Clock,
  },
  {
    key: "payment",
    status: "APPROVED_PENDING_PAYMENT",
    labelKey: "permits.roadClosure.phases.paymentLabel",
    shortLabelKey: "permits.roadClosure.phases.paymentShort",
    icon: CreditCard,
  },
  {
    key: "approved",
    status: "ISSUED",
    labelKey: "permits.roadClosure.phases.approvedLabel",
    shortLabelKey: "permits.roadClosure.phases.approvedShort",
    icon: BadgeCheck,
  },
] as const

function phaseIndexFromStatus(status: string | undefined): number {
  const value = (status ?? "").toUpperCase()
  if (
    value === "ISSUED" ||
    value === "APPROVED" ||
    value === "ACTIVE" ||
    value === "COMPLETED"
  ) {
    return 2
  }
  if (
    value === "APPROVED_PENDING_PAYMENT" ||
    value === "PENDING_PAYMENT" ||
    value === "AWAITING_PAYMENT"
  ) {
    return 1
  }
  return 0
}

function initialForm(): RoadClosureForm {
  return {
    purpose: "CONSTRUCTION",
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

function formatDateTime(value: string | undefined, t: TFunction) {
  if (!value) return t("common.notRecorded")
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
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

function isValidRequest(form: RoadClosureForm, routeId: string | null) {
  if (!routeId) return false
  if (!form.requestedStartAt || !form.requestedEndAt) return false
  const start = new Date(form.requestedStartAt).getTime()
  const end = new Date(form.requestedEndAt).getTime()
  return Number.isFinite(start) && Number.isFinite(end) && end > start
}

function StatusBadge({ status }: { status: string | undefined }) {
  const { t } = useTranslation()
  const normalized = status ?? "PENDING_ADMIN_APPROVAL"
  const variant =
    normalized === "REJECTED"
      ? "destructive"
      : normalized === "ISSUED" || normalized === "APPROVED"
        ? "default"
        : "secondary"
  return <Badge variant={variant}>{formatPurpose(normalized, t)}</Badge>
}

function PhaseStepper({ currentIndex }: { currentIndex: number }) {
  const { t } = useTranslation()
  return (
    <ol className="flex items-center gap-1.5">
      {PERMIT_PHASES.map((phase, index) => {
        const Icon = phase.icon
        const isDone = index < currentIndex
        const isCurrent = index === currentIndex
        const isLast = index === PERMIT_PHASES.length - 1
        return (
          <li key={phase.key} className="flex items-center gap-1.5">
            <span className="flex flex-col items-center gap-1">
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-xs transition-colors",
                  isDone &&
                    "border-primary bg-primary text-primary-foreground",
                  isCurrent &&
                    "border-primary bg-primary/10 text-primary ring-2 ring-primary/20",
                  !isDone &&
                    !isCurrent &&
                    "border-border bg-card text-muted-foreground"
                )}
              >
                {isDone ? (
                  <Check className="size-3.5" />
                ) : (
                  <Icon className="size-3.5" />
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium whitespace-nowrap",
                  isCurrent
                    ? "text-foreground"
                    : isDone
                      ? "text-primary"
                      : "text-muted-foreground"
                )}
              >
                {t(phase.shortLabelKey)}
              </span>
            </span>
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "mb-4 h-0.5 w-6 rounded-full transition-colors sm:w-10",
                  index < currentIndex ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
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

function PermitCard({ permit }: { permit: RoadClosurePermit }) {
  const { t } = useTranslation()
  const route = permit.route as MunicipalRoute | undefined
  const invoice = permit.invoice ?? null
  const amount =
    typeof invoice?.amount === "number"
      ? invoice.amount
      : typeof invoice?.totalAmount === "number"
        ? invoice.totalAmount
        : null
  const phaseIndex = phaseIndexFromStatus(permit.status)

  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-muted-foreground">
              {permit.id}
            </p>
            <h3 className="mt-1 truncate text-base font-semibold text-foreground">
              {route ? routeLabel(route) : t("common.notRecorded")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(permit.requestedStartAt, t)} -{" "}
              {formatDateTime(permit.requestedEndAt, t)}
            </p>
          </div>
        </div>
        <StatusBadge status={permit.status} />
      </div>

      <div className="mt-5 flex justify-center border-t border-border pt-4">
        <PhaseStepper currentIndex={phaseIndex} />
      </div>

      <div className="mt-5 grid gap-4 border-t border-border pt-4 md:grid-cols-4">
        <Meta
          label={t("permits.roadClosure.applicantName")}
          value={permit.applicantName ?? t("common.notRecorded")}
        />
        <Meta
          label={t("permits.roadClosure.applicantPhone")}
          value={permit.applicantPhone ?? t("common.notRecorded")}
        />
        <Meta
          label={t("permits.roadClosure.purpose")}
          value={formatPurpose(permit.purpose, t)}
        />
        <Meta
          label={t("common.total")}
          value={
            amount === null
              ? t("common.notRecorded")
              : `${formatMzn(amount)} ${invoice?.currency ?? "MZN"}`
          }
        />
      </div>
    </article>
  )
}

export default function Permits() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const creating = params.get("mode") === "new"
  const [query, setQuery] = useState("")
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [form, setForm] = useState<RoadClosureForm>(() => initialForm())

  const routesQuery = useQuery({
    queryKey: ["road-closure-routes", MUNICIPALITY_ID],
    queryFn: () => listRoadClosureRoutes(MUNICIPALITY_ID),
    enabled: creating && !!MUNICIPALITY_ID,
  })

  const reviewQuery = useQuery({
    queryKey: ["road-closure-permits", MUNICIPALITY_ID, PERMIT_PHASES[0].status],
    queryFn: () =>
      listRoadClosurePermits(MUNICIPALITY_ID, PERMIT_PHASES[0].status),
    enabled: !creating && !!MUNICIPALITY_ID,
  })
  const paymentQuery = useQuery({
    queryKey: ["road-closure-permits", MUNICIPALITY_ID, PERMIT_PHASES[1].status],
    queryFn: () =>
      listRoadClosurePermits(MUNICIPALITY_ID, PERMIT_PHASES[1].status),
    enabled: !creating && !!MUNICIPALITY_ID,
  })
  const approvedQuery = useQuery({
    queryKey: ["road-closure-permits", MUNICIPALITY_ID, PERMIT_PHASES[2].status],
    queryFn: () =>
      listRoadClosurePermits(MUNICIPALITY_ID, PERMIT_PHASES[2].status),
    enabled: !creating && !!MUNICIPALITY_ID,
  })
  const phaseQueries = [reviewQuery, paymentQuery, approvedQuery] as const

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
      return createRoadClosurePermit({
        municipalityId: MUNICIPALITY_ID,
        routeId: selectedRouteId,
        purpose: form.purpose,
        requestedStartAt: toIsoFromLocalInput(form.requestedStartAt),
        requestedEndAt: toIsoFromLocalInput(form.requestedEndAt),
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

  const phasePermits = useMemo(
    () => phaseQueries.map((query) => query.data ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reviewQuery.data, paymentQuery.data, approvedQuery.data]
  )
  const totalPermits = phasePermits.reduce(
    (sum, permits) => sum + permits.length,
    0
  )
  const anyLoading = phaseQueries.some((q) => q.isLoading)
  const allErrored = phaseQueries.every((q) => q.isError)
  const defaultPhase: PermitPhaseKey =
    PERMIT_PHASES.find((_phase, index) => phasePermits[index].length > 0)?.key ??
    "review"

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

        {allErrored && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>{t("permits.roadClosure.pendingFailed")}</AlertTitle>
            <AlertDescription>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  phaseQueries.forEach((query) => void query.refetch())
                }}
                className="mt-2 gap-2"
              >
                <RefreshCw className="size-3.5" />
                {t("common.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {anyLoading && totalPermits === 0 ? (
          <div className="flex h-64 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-sm text-muted-foreground">
            <Spinner />
            {t("permits.roadClosure.loadingPending")}
          </div>
        ) : totalPermits === 0 && !allErrored ? (
          <Card>
            <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <FileText className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {t("permits.roadClosure.noPendingTitle")}
                </h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {t("permits.roadClosure.noPendingDescription")}
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
          <Tabs defaultValue={defaultPhase} className="gap-4">
            <TabsList variant="line" className="border-b border-border pb-1">
              {PERMIT_PHASES.map((phase, index) => {
                const Icon = phase.icon
                const count = phasePermits[index].length
                return (
                  <TabsTrigger key={phase.key} value={phase.key}>
                    <Icon />
                    {t(phase.labelKey)}
                    <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
            {PERMIT_PHASES.map((phase, index) => {
              const permits = phasePermits[index]
              const query = phaseQueries[index]
              return (
                <TabsContent
                  key={phase.key}
                  value={phase.key}
                  className="mt-0 space-y-4"
                >
                  {query.isError ? (
                    <Alert variant="destructive">
                      <AlertCircle />
                      <AlertTitle>
                        {t("permits.roadClosure.pendingFailed")}
                      </AlertTitle>
                      <AlertDescription>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void query.refetch()}
                          className="mt-2 gap-2"
                        >
                          <RefreshCw className="size-3.5" />
                          {t("common.retry")}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : query.isLoading && permits.length === 0 ? (
                    <div className="flex h-40 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-sm text-muted-foreground">
                      <Spinner />
                      {t("permits.roadClosure.loadingPending")}
                    </div>
                  ) : permits.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                      {t("permits.roadClosure.phases.empty", {
                        phase: t(phase.labelKey),
                      })}
                    </div>
                  ) : (
                    permits.map((permit) => (
                      <PermitCard key={permit.id} permit={permit} />
                    ))
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        )}
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
              <div className="h-[360px] overflow-hidden rounded-xl border border-border bg-muted/20">
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
