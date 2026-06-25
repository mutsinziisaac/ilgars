import { test, expect } from "./fixtures"
import { NAV_TARGETS } from "./nav"

/**
 * The single place backend 5xx surfaces: walk every portal page and assert no
 * Core/Motorvehicle API call returned a 5xx during the run.
 */
test("no 5xx across portal pages", async ({ page, serverErrors }) => {
  for (const target of NAV_TARGETS) {
    await page.goto(target.path)
    await expect(page.locator("aside").first()).toBeVisible({ timeout: 30_000 })
    await page.waitForLoadState("networkidle").catch(() => {})
  }
  expect(serverErrors, `5xx responses seen: ${JSON.stringify(serverErrors, null, 2)}`).toEqual([])
})
