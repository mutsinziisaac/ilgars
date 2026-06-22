import { test, expect } from "./fixtures"
import { NAV_TARGETS } from "./nav"

/**
 * Per-page render health against live UAT: every authenticated portal page must
 * render the app shell (sidebar), show its page-specific marker, and throw no
 * uncaught exception.
 */
test.describe("Transporter portal smoke (authenticated, live UAT)", () => {
  for (const target of NAV_TARGETS) {
    test(`page renders: ${target.key}`, async ({ page, pageErrors }) => {
      await page.goto(target.path)

      // Authenticated shell rendered. The sidebar is the first <aside>, and the
      // layout <main> is the first <main> — some pages nest their own <aside>
      // (stepper/preview) and <main>, hence .first() on both.
      const shellMain = page.locator("main").first()
      await expect(page.locator("aside").first()).toBeVisible({ timeout: 30_000 })
      await expect(shellMain).toBeVisible()

      const m = target.marker
      if (m.kind === "heading") {
        await expect(page.getByRole("heading", { name: m.text }).first()).toBeVisible({ timeout: 20_000 })
      } else if (m.kind === "header") {
        await expect(page.locator("header").getByText(m.text, { exact: false }).first()).toBeVisible({
          timeout: 20_000,
        })
      } else {
        await expect(shellMain.getByText(m.text, { exact: false }).first()).toBeVisible({
          timeout: 20_000,
        })
      }

      expect(pageErrors, `uncaught errors on ${target.key}: ${pageErrors.join(" | ")}`).toEqual([])
    })
  }
})
