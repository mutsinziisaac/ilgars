import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CheckCircle2, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const COUNTRY_CODES = [
  "botswana",
  "eswatini",
  "malawi",
  "mozambique",
  "southAfrica",
  "tanzania",
  "zambia",
  "zimbabwe",
] as const

type CountryCode = (typeof COUNTRY_CODES)[number]

type FormState = {
  chestId: string
  companyName: string
  email: string
  phone: string
  country: CountryCode
}

type FormErrors = Partial<Record<keyof FormState, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function emptyForm(): FormState {
  return {
    chestId: "",
    companyName: "",
    email: "",
    phone: "",
    country: "mozambique",
  }
}

export function RegistrationDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})

  useEffect(() => {
    if (!open) {
      setForm(emptyForm())
      setErrors({})
      setSubmitted(false)
    }
  }, [open])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const validate = (): FormErrors => {
    const next: FormErrors = {}
    const required = t("landing.registration.errors.required")

    if (!form.chestId.trim()) {
      next.chestId = required
    } else if (form.chestId.trim().length < 4) {
      next.chestId = t("landing.registration.errors.chestId")
    }
    if (!form.companyName.trim()) next.companyName = required
    if (!form.email.trim()) {
      next.email = required
    } else if (!EMAIL_PATTERN.test(form.email.trim())) {
      next.email = t("landing.registration.errors.email")
    }
    if (!form.phone.trim()) next.phone = required
    if (!form.country) next.country = required

    return next
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    setSubmitted(true)
    toast.success(
      t("landing.registration.toastSuccess", { email: form.email.trim() })
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          className="rounded-lg"
        >
          <UserPlus className="size-4" />
          {t("landing.registration.cta")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {submitted ? (
          <>
            <DialogHeader>
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <CheckCircle2 className="size-6" />
              </div>
              <DialogTitle>
                {t("landing.registration.success.title")}
              </DialogTitle>
              <DialogDescription>
                {t("landing.registration.success.description", {
                  email: form.email.trim(),
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg"
              >
                {t("landing.registration.success.done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <DialogHeader className="mb-4">
              <DialogTitle>{t("landing.registration.title")}</DialogTitle>
              <DialogDescription>
                {t("landing.registration.description")}
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="gap-5">
              <Field data-invalid={errors.chestId ? "true" : undefined}>
                <FieldLabel htmlFor="registration-chest-id">
                  {t("landing.registration.chestId")}
                </FieldLabel>
                <Input
                  id="registration-chest-id"
                  value={form.chestId}
                  onChange={(event) => update("chestId", event.target.value)}
                  placeholder={t("landing.registration.chestIdPlaceholder")}
                  aria-invalid={errors.chestId ? "true" : undefined}
                  autoComplete="off"
                />
                {errors.chestId && <FieldError>{errors.chestId}</FieldError>}
              </Field>

              <Field data-invalid={errors.companyName ? "true" : undefined}>
                <FieldLabel htmlFor="registration-company">
                  {t("landing.registration.companyName")}
                </FieldLabel>
                <Input
                  id="registration-company"
                  value={form.companyName}
                  onChange={(event) =>
                    update("companyName", event.target.value)
                  }
                  placeholder={t("landing.registration.companyNamePlaceholder")}
                  aria-invalid={errors.companyName ? "true" : undefined}
                  autoComplete="organization"
                />
                {errors.companyName && (
                  <FieldError>{errors.companyName}</FieldError>
                )}
              </Field>

              <Field data-invalid={errors.email ? "true" : undefined}>
                <FieldLabel htmlFor="registration-email">
                  {t("landing.registration.email")}
                </FieldLabel>
                <Input
                  id="registration-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  placeholder={t("landing.registration.emailPlaceholder")}
                  aria-invalid={errors.email ? "true" : undefined}
                  autoComplete="email"
                />
                {errors.email && <FieldError>{errors.email}</FieldError>}
              </Field>

              <Field data-invalid={errors.phone ? "true" : undefined}>
                <FieldLabel htmlFor="registration-phone">
                  {t("landing.registration.phone")}
                </FieldLabel>
                <Input
                  id="registration-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  placeholder={t("landing.registration.phonePlaceholder")}
                  aria-invalid={errors.phone ? "true" : undefined}
                  autoComplete="tel"
                />
                {errors.phone && <FieldError>{errors.phone}</FieldError>}
              </Field>

              <Field data-invalid={errors.country ? "true" : undefined}>
                <FieldLabel htmlFor="registration-country">
                  {t("landing.registration.country")}
                </FieldLabel>
                <Select
                  value={form.country}
                  onValueChange={(value) =>
                    update("country", value as CountryCode)
                  }
                >
                  <SelectTrigger
                    id="registration-country"
                    className="w-full"
                    aria-invalid={errors.country ? "true" : undefined}
                  >
                    <SelectValue
                      placeholder={t(
                        "landing.registration.countryPlaceholder"
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {t(`landing.registration.countries.${code}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.country && <FieldError>{errors.country}</FieldError>}
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={() => setOpen(false)}
              >
                {t("landing.registration.cancel")}
              </Button>
              <Button type="submit" className="rounded-lg">
                {t("landing.registration.submit")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
