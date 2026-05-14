import { PageStub } from "@/components/layout/page-stub"
import { useTranslation } from "react-i18next"

export default function Transactions() {
  const { t } = useTranslation()
  return <PageStub title={t("nav.transactions")} />
}
