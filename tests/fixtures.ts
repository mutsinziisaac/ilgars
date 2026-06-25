import { test as base, expect } from "@playwright/test"

interface Fixtures {
  /** Uncaught exceptions thrown in the page during the test (a real crash). */
  pageErrors: string[]
  /** 5xx responses from the ILGARS API origins seen during the test. */
  serverErrors: { url: string; status: number }[]
}

export const test = base.extend<Fixtures>({
  pageErrors: async ({ page }, use) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await use(errors)
  },

  serverErrors: async ({ page }, use) => {
    const errors: { url: string; status: number }[] = []
    page.on("response", (response) => {
      const status = response.status()
      const url = response.url()
      // Core (/core/api) + Motorvehicle (/motorvehicle) are reached via the Vite dev proxy.
      if (status >= 500 && /\/(core\/api|motorvehicle)\//.test(url)) {
        errors.push({ url, status })
      }
    })
    await use(errors)
  },
})

// Force English so text assertions are deterministic regardless of the runner's
// navigator language (the app's i18n detects localStorage → navigator).
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("ilgars-language", "en")
    } catch {
      /* storage may be unavailable on some origins (e.g. the KC page) — ignore */
    }
  })
})

export { expect }
