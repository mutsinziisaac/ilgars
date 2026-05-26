import { useState } from "react"
import { BadgeCheck, CreditCard, Smartphone, Wallet } from "lucide-react"
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
import type { RoadClosurePermit } from "@/lib/trips-api"
import { cn } from "@/lib/utils"

type Channel = "mobile" | "card" | "wallet"

const CHANNELS: { key: Channel; icon: typeof Smartphone }[] = [
  { key: "mobile", icon: Smartphone },
  { key: "card", icon: CreditCard },
  { key: "wallet", icon: Wallet },
]

const CHANNEL_LABELS: Record<Channel, string> = {
  mobile: "Mobile Money",
  card: "Card",
  wallet: "Wallet",
}

function invoiceAmount(permit: RoadClosurePermit | null) {
  const invoice = permit?.invoice ?? null
  if (typeof invoice?.amount === "number") return invoice.amount
  if (typeof invoice?.totalAmount === "number") return invoice.totalAmount
  return null
}

export function PermitPaymentDialog({
  permit,
  onOpenChange,
  onPaid,
}: {
  permit: RoadClosurePermit | null
  onOpenChange: (open: boolean) => void
  onPaid: () => void
}) {
  const { t } = useTranslation()
  const [channel, setChannel] = useState<Channel>("mobile")
  const [phase, setPhase] = useState<"form" | "processing" | "success">("form")

  const invoice = permit?.invoice ?? null
  const amount = invoiceAmount(permit)
  const currency = invoice?.currency ?? "MZN"
  const amountLabel = amount === null ? "—" : `${formatMzn(amount)} ${currency}`
  const hasInvoice = amount !== null || !!invoice?.prn

  const pay = () => {
    setPhase("processing")
    window.setTimeout(() => setPhase("success"), 1100)
  }

  const close = () => {
    if (phase === "success") onPaid()
    onOpenChange(false)
    // Reset for the next time the dialog opens.
    setPhase("form")
    setChannel("mobile")
  }

  return (
    <Dialog open={permit !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("permits.payment.title")}</DialogTitle>
          <DialogDescription>
            {t("permits.payment.description", { permitId: permit?.id ?? "" })}
          </DialogDescription>
        </DialogHeader>

        {phase === "success" ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BadgeCheck className="size-7" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {t("permits.payment.successTitle")}
              </h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                {t("permits.payment.successDescription", {
                  permitId: permit?.id ?? "",
                })}
              </p>
            </div>
          </div>
        ) : !hasInvoice ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("permits.payment.noInvoice")}
          </p>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                  {t("permits.payment.amount")}
                </span>
                <span className="font-mono text-xl font-semibold text-foreground">
                  {amountLabel}
                </span>
              </div>
              {invoice?.prn && (
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                    {t("permits.payment.prn")}
                  </span>
                  <span className="font-mono text-sm text-foreground">
                    {invoice.prn}
                  </span>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                {t("permits.payment.channelsTitle")}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {CHANNELS.map(({ key, icon: Icon }) => {
                  const selected = channel === key
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={phase === "processing"}
                      onClick={() => setChannel(key)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/30"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-md",
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {CHANNEL_LABELS[key]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {phase === "success" ? (
            <Button type="button" onClick={close} className="rounded-md">
              {t("permits.payment.done")}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={pay}
              disabled={!hasInvoice || phase === "processing"}
              className="rounded-md"
            >
              {phase === "processing" ? (
                <>
                  <Spinner />
                  {t("permits.payment.processing")}
                </>
              ) : (
                t("permits.payment.payAction", { amount: amountLabel })
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
