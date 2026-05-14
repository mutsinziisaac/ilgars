import { useTranslation } from "react-i18next"

export function PageStub({ title }: { title: string }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-2xl border border-border bg-card p-12 text-muted-foreground">
      <p className="text-sm">
        <span className="font-medium text-foreground">{title}</span>
        <span className="mx-2">·</span>
        {t("stubs.contentSlot")}
      </p>
    </div>
  )
}
