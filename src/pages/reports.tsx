import { PageStub } from "@/components/layout/page-stub"
import { useTranslation } from "react-i18next"

export default function Reports() {
  const { t } = useTranslation()
  return <PageStub title={t("nav.reports")} />
}
