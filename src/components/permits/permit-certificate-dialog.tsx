import { useRef, useState } from "react"
import { Download } from "lucide-react"
import QRCode from "react-qr-code"
import { toPng } from "html-to-image"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { formatMzn } from "@/lib/fleet"
import type { MunicipalRoute, RoadClosurePermit } from "@/lib/trips-api"

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "")
}

function routeLabel(route: Partial<MunicipalRoute> | undefined) {
  if (!route) return null
  return route.name ?? route.routeName ?? route.code ?? route.routeCode ?? null
}

function titleCase(value: string | undefined) {
  if (!value) return null
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatDateRange(start: string | undefined, end: string | undefined) {
  const fmt = (value: string | undefined) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  }
  const s = fmt(start)
  const e = fmt(end)
  if (!s && !e) return null
  if (s && e) return `${s} — ${e}`
  return s ?? e
}

function amountFromInvoice(permit: RoadClosurePermit) {
  const invoice = permit.invoice ?? null
  const amount =
    typeof invoice?.amount === "number"
      ? invoice.amount
      : typeof invoice?.totalAmount === "number"
        ? invoice.totalAmount
        : null
  if (amount === null) return null
  return `${formatMzn(amount)} ${invoice?.currency ?? "MZN"}`
}

function CornerOrnament({
  position,
}: {
  position: "tl" | "tr" | "bl" | "br"
}) {
  const map: Record<typeof position, string> = {
    tl: "top-3 left-3 border-t-2 border-l-2",
    tr: "top-3 right-3 border-t-2 border-r-2",
    bl: "bottom-3 left-3 border-b-2 border-l-2",
    br: "bottom-3 right-3 border-b-2 border-r-2",
  }
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute size-6 border-primary/60 ${map[position]}`}
    />
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold tracking-[0.2em] text-primary/70 uppercase">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  )
}

export function PermitCertificateDialog({
  permit,
  onOpenChange,
}: {
  permit: RoadClosurePermit | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const certificateRef = useRef<HTMLDivElement | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const downloadCertificate = async () => {
    if (!permit || !certificateRef.current) return
    setIsDownloading(true)
    try {
      const dataUrl = await toPng(certificateRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      })
      const link = document.createElement("a")
      link.download = `permit-certificate-${safeFilePart(permit.id) || "permit"}.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      link.remove()
    } finally {
      setIsDownloading(false)
    }
  }

  const route = permit?.route as Partial<MunicipalRoute> | undefined
  const label = routeLabel(route)
  const purpose = titleCase(permit?.purpose as string | undefined)
  const status = titleCase(permit?.status)
  const window = formatDateRange(
    permit?.requestedStartAt,
    permit?.requestedEndAt
  )
  const amount = permit ? amountFromInvoice(permit) : null
  const applicant = permit?.applicantName ?? null
  const conditions =
    typeof permit?.conditions === "string" && permit.conditions.trim().length
      ? permit.conditions.trim()
      : null
  const issuedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
  }).format(new Date())

  return (
    <Dialog open={permit !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("permits.roadClosure.certificateTitle")}</DialogTitle>
          <DialogDescription>
            {t("permits.roadClosure.certificateDescription")}
          </DialogDescription>
        </DialogHeader>
        {permit && (
          <div className="flex justify-center py-1">
            <div
              ref={certificateRef}
              className="relative flex w-full max-w-[400px] flex-col overflow-hidden bg-[#fdfcf6] text-foreground shadow-[0_30px_60px_-15px_rgba(15,23,42,0.25)] ring-1 ring-foreground/10"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-2 border-2 border-primary/30"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-3 border border-primary/15"
              />
              <CornerOrnament position="tl" />
              <CornerOrnament position="tr" />
              <CornerOrnament position="bl" />
              <CornerOrnament position="br" />

              <img
                src="/maputo-logo.webp"
                alt=""
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.06]"
              />

              <div className="relative flex flex-1 flex-col px-6 py-5 sm:px-9 sm:py-7">
                <div className="flex flex-col items-center text-center">
                  <img
                    src="/maputo-logo.webp"
                    alt=""
                    aria-hidden
                    className="size-12 object-contain"
                  />
                  <p className="mt-2 text-[9px] font-semibold tracking-[0.3em] text-primary/80 uppercase">
                    Conselho Municipal de Maputo
                  </p>
                  <h2 className="mt-3 font-serif text-2xl leading-tight font-semibold tracking-wide text-foreground sm:text-[26px]">
                    {t("permits.roadClosure.certificateEyebrow")}
                  </h2>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="h-px w-12 bg-primary/40" />
                    <span className="size-1.5 rounded-full bg-primary/60" />
                    <span className="h-px w-12 bg-primary/40" />
                  </div>
                  <p className="mt-3 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                    Nº {permit.id}
                  </p>
                </div>

                <div className="mt-5 text-center">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    This permit certifies the authorization of a temporary
                    municipal road closure on the route:
                  </p>
                  <p className="mt-3 font-serif text-xl leading-snug font-semibold text-foreground italic sm:text-[22px]">
                    {label ?? t("common.notRecorded")}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-primary/20 py-4">
                  <Field
                    label={t("permits.roadClosure.purpose")}
                    value={purpose}
                  />
                  <Field
                    label={t("permits.roadClosure.applicantName")}
                    value={applicant}
                  />
                  <div className="col-span-2">
                    <Field
                      label={t("permits.roadClosure.window")}
                      value={window}
                    />
                  </div>
                  <Field label={t("common.status")} value={status} />
                  <Field label={t("common.total")} value={amount} />
                </div>

                {conditions && (
                  <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground italic">
                    “{conditions}”
                  </p>
                )}

                <div className="mt-auto flex items-end justify-between gap-6 pt-5">
                  <div className="flex flex-col items-center">
                    <div className="rounded-md border border-primary/20 bg-white p-2 shadow-sm">
                      <QRCode
                        value={permit.id}
                        size={64}
                        className="block h-auto w-16"
                        bgColor="#ffffff"
                        fgColor="#0f172a"
                        title={t("permits.roadClosure.qrPermitId", {
                          permitId: permit.id,
                        })}
                      />
                    </div>
                    <p className="mt-1.5 text-[9px] tracking-widest text-muted-foreground uppercase">
                      Scan to verify
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col items-end">
                    <span className="h-px w-44 bg-foreground/40" />
                    <p className="mt-1 text-[10px] font-semibold tracking-widest text-foreground uppercase">
                      Issuing Authority
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Conselho Municipal de Maputo
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Issued · {issuedDate}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            onClick={downloadCertificate}
            disabled={!permit || isDownloading}
            className="rounded-md"
          >
            {isDownloading ? <Spinner /> : <Download className="size-4" />}
            {t("permits.roadClosure.downloadCertificate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
