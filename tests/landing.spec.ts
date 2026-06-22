import { test, expect } from "./fixtures"

/**
 * The public prepaid-trip landing ("/") requires no login — it must render the
 * hero + the create-trip entry point with no uncaught exception.
 */
test("public trip landing renders (no auth required)", async ({ page, pageErrors }) => {
  await page.goto("/")
  await expect(
    page.getByText("Declare a Maputo trip before the truck reaches the city.").first(),
  ).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText("Create prepaid trip").first()).toBeVisible()
  expect(pageErrors, `uncaught errors on landing: ${pageErrors.join(" | ")}`).toEqual([])
})
