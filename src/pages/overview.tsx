import {
  AlertCircle,
  ArrowUpRight,
  Clock,
  FileCheck,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { formatCurrencyMzn } from "@/i18n/format"

export default function Overview() {
  return (
    <div className="space-y-4">
      <FleetStatusStrip />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FleetAtAGlance />
        </div>
        <div className="lg:col-span-1">
          <WhatNeedsAttention />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SpendingChart />
        </div>
        <div className="lg:col-span-1">
          <RecentReceipts />
        </div>
      </div>
    </div>
  )
}

const STATUS_METRICS: {
  labelKey: string
  valueKey?: string
  value?: string
  accent?: boolean
}[] = [
  { labelKey: "overview.fleetStatus", valueKey: "overview.allCompliant", accent: true },
  { labelKey: "overview.activeTrips", value: "1" },
  { labelKey: "overview.paidThisMonth", value: "47,500" },
  { labelKey: "overview.nextRenewal", value: "4d" },
]

function FleetStatusStrip() {
  const { t } = useTranslation()
  return (
    <div className="relative overflow-hidden rounded-xl bg-sidebar text-sidebar-foreground">
      <div className="grid grid-cols-2 gap-y-4 px-6 py-5 md:grid-cols-4">
        {STATUS_METRICS.map((metric) => (
          <div key={metric.labelKey} className="relative flex flex-col gap-1.5">
            <p className="text-[10px] font-medium tracking-widest text-secondary uppercase">
              {t(metric.labelKey)}
            </p>
            <p className="text-2xl font-semibold tracking-tight">
              {metric.valueKey ? t(metric.valueKey) : metric.value}
            </p>
            {metric.accent && (
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 h-0.5 w-24 rounded-full bg-secondary"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const FLEET = [
  {
    plate: "AAB 482 MC",
    class: "Articulated · 4 axles · 32,500 kg",
    status: "compliant" as const,
    trip: "Day 2 of 5 · TX-08471",
  },
  {
    plate: "AAJ 119 MC",
    class: "Articulated · 4 axles · 28,200 kg",
    status: "renewal-soon" as const,
    trip: null,
  },
  {
    plate: "ABT 770 MC",
    class: "Rigid · 3 axles · 19,800 kg",
    status: "compliant" as const,
    trip: null,
  },
  {
    plate: "ABT 884 MC",
    class: "Articulated · 5 axles · 41,200 kg",
    status: "compliant" as const,
    trip: "Day 1 of 3 · TX-08502",
  },
  {
    plate: "ZAB 217 MC",
    class: "Rigid · 2 axles · 11,400 kg",
    status: "renewal-soon" as const,
    trip: null,
  },
]

function FleetAtAGlance() {
  const { t } = useTranslation()
  return (
    <Card>
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {t("overview.fleetAtGlance")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("overview.vehiclesInCity", { vehicles: 5, count: 2 })}
          </p>
        </div>
        <NavLink
          to="/portal/fleet"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t("overview.manageFleet")}
          <ArrowUpRight className="size-3.5" />
        </NavLink>
      </div>

      <div className="hidden grid-cols-[1.1fr_1.6fr_1fr_1.4fr_auto] items-center gap-x-4 px-5 pb-2 text-[10px] font-medium tracking-widest text-muted-foreground uppercase lg:grid">
        <span>{t("common.plate")}</span>
        <span>{t("common.class")}</span>
        <span>{t("common.status")}</span>
        <span>{t("overview.activeTrip")}</span>
        <span />
      </div>

      {/* Desktop: table rows */}
      <ul className="hidden divide-y divide-border border-t border-border lg:block">
        {FLEET.map((truck) => (
          <li
            key={truck.plate}
            className="grid grid-cols-[1.1fr_1.6fr_1fr_1.4fr_auto] items-center gap-x-4 px-5 py-3"
          >
            <span className="text-sm font-medium tracking-wide text-foreground">
              {truck.plate}
            </span>
            <span className="text-xs text-muted-foreground">{truck.class}</span>
            <StatusPill status={truck.status} />
            <span className="text-xs text-muted-foreground">
              {truck.trip ?? "—"}
            </span>
            <NavLink
              to="/portal/fleet"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {t("overview.open")}
              <ArrowUpRight className="size-3" />
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Mobile: stacked cards */}
      <ul className="space-y-3 border-t border-border p-4 lg:hidden">
        {FLEET.map((truck) => (
          <li key={truck.plate}>
            <NavLink
              to="/portal/fleet"
              className="flex flex-col gap-2 rounded-lg border border-border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium tracking-wide text-foreground">
                  {truck.plate}
                </span>
                <StatusPill status={truck.status} />
              </div>
              <span className="text-xs text-muted-foreground">
                {truck.class}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("overview.activeTrip")}: {truck.trip ?? "—"}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function StatusPill({ status }: { status: "compliant" | "renewal-soon" }) {
  const { t } = useTranslation()
  if (status === "compliant") {
    return (
      <Badge
        variant="secondary"
        className="bg-chart-1/60 px-2 py-0.5 text-[11px] text-primary"
      >
        {t("overview.compliant")}
      </Badge>
    )
  }
  return (
    <Badge
      variant="secondary"
      className="bg-accent px-2 py-0.5 text-[11px] text-accent-foreground"
    >
      {t("overview.renewalSoon")}
    </Badge>
  )
}

function WhatNeedsAttention() {
  const { t } = useTranslation()
  const attention = [
    {
      icon: Clock,
      iconBg: "bg-accent text-secondary",
      title: t("overview.renewalIn4Days"),
      subtitle: t("overview.circulationLicenceVehicle", { plate: "AAJ 119 MC" }),
      amount: "2,000",
    },
    {
      icon: FileCheck,
      iconBg: "bg-chart-1/60 text-primary",
      title: t("overview.permitAwaitingPayment"),
      subtitle: "PRM-26-0823 · Filming · Approved",
      amount: "150,000",
    },
    {
      icon: Receipt,
      iconBg: "bg-muted text-muted-foreground",
      title: t("overview.receiptAvailable"),
      subtitle: "TX-08471 · Cargo licence 5d",
      amount: "15,000",
    },
    {
      icon: Wallet,
      iconBg: "bg-accent text-secondary",
      title: t("overview.walletRunningLow"),
      subtitle: t("overview.balanceBelow", { amount: "5,000" }),
      amount: "4,250",
    },
    {
      icon: AlertCircle,
      iconBg: "bg-chart-1/60 text-primary",
      title: t("overview.dailyAuthorisationDue"),
      subtitle: t("overview.endsToday", { plate: "AAB 482 MC" }),
      amount: "1,000",
    },
  ]
  return (
    <Card>
      <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-1">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {t("overview.whatNeedsAttention")}
        </h2>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
        >
          {t("overview.seeAll")}
        </button>
      </div>
      <ul className="px-2 pt-2 pb-3">
        {attention.map((item) => {
          const Icon = item.icon
          return (
            <li
              key={item.title}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-muted/60"
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  item.iconBg
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {item.title}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {item.subtitle}
                </p>
              </div>
              <p className="shrink-0 text-xs font-medium text-foreground">
                {item.amount}
                <span className="ml-1 text-[10px] text-muted-foreground">
                  MZN
                </span>
              </p>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

const SPENDING = [
  { month: "Jun", amount: 18_500 },
  { month: "Jul", amount: 22_000 },
  { month: "Aug", amount: 26_500 },
  { month: "Sep", amount: 24_000 },
  { month: "Oct", amount: 30_000 },
  { month: "Nov", amount: 35_000 },
  { month: "Dec", amount: 32_000 },
  { month: "Jan", amount: 41_500 },
  { month: "Feb", amount: 28_000 },
  { month: "Mar", amount: 56_000 },
  { month: "Apr", amount: 64_000 },
  { month: "May", amount: 63_000 },
]

const SPENDING_TOTAL = SPENDING.reduce((sum, d) => sum + d.amount, 0)

const chartConfig = {
  amount: {
    label: "Spent",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig

function SpendingChart() {
  const { t } = useTranslation()
  return (
    <Card>
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            {t("overview.spending12")}
          </p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
            {formatCurrencyMzn(SPENDING_TOTAL)}{" "}
            <span className="text-sm font-medium text-muted-foreground">
              MZN
            </span>
          </p>
        </div>
        <Badge
          variant="secondary"
          className="gap-1 bg-chart-1/60 px-2 py-0.5 text-[11px] text-primary"
        >
          <TrendingUp className="size-3" />
          +8.4%
        </Badge>
      </div>
      <div className="px-3 pt-4 pb-4">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-40 w-full"
        >
          <BarChart
            accessibilityLayer
            data={SPENDING}
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="var(--border)"
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis hide domain={[0, "dataMax + 10000"]} />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground capitalize">
                        {String(name)}
                      </span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {formatCurrencyMzn(Number(value))}
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          MZN
                        </span>
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={36}>
              {SPENDING.map((entry, index) => (
                <Cell
                  key={entry.month}
                  fill={
                    index === SPENDING.length - 1
                      ? "var(--chart-5)"
                      : "var(--chart-1)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </Card>
  )
}

function RecentReceipts() {
  const { t } = useTranslation()
  const receipts = [
    { date: "4 May", title: t("overview.cargoLicenceDays", { count: 5 }), plate: "AAB 482 MC", amount: "15,000" },
    { date: "28 Apr", title: t("overview.dailyAuthorisation"), plate: "AAJ 119 MC", amount: "1,000" },
    { date: "22 Apr", title: t("overview.cargoLicenceDays", { count: 3 }), plate: "ABT 770 MC", amount: "9,000" },
    { date: "15 Apr", title: t("overview.specialCirculation"), plate: "AAB 482 MC", amount: "20,000" },
    { date: "8 Apr", title: t("overview.cargoLicenceDays", { count: 2 }), plate: "ABT 770 MC", amount: "6,000" },
  ]
  return (
    <Card>
      <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-1">
        <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          {t("overview.recentReceipts")}
        </p>
      </div>
      <ul className="divide-y divide-border px-5">
        {receipts.map((receipt) => (
          <li
            key={receipt.title + receipt.date}
            className="flex items-center gap-3 py-2.5"
          >
            <span className="w-10 shrink-0 text-[11px] font-medium text-muted-foreground">
              {receipt.date}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {receipt.title}
              </p>
              <p className="truncate text-[11px] tracking-wide text-muted-foreground">
                {receipt.plate}
              </p>
            </div>
            <p className="shrink-0 text-xs font-medium text-foreground">
              {receipt.amount}
              <span className="ml-1 text-[10px] text-muted-foreground">
                MZN
              </span>
            </p>
          </li>
        ))}
      </ul>
      <div className="h-2" />
    </Card>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      {children}
    </section>
  )
}
