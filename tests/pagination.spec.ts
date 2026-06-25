import { test, expect } from "./fixtures"

/**
 * The portal loads complete server-paginated lists via fetchAllPages
 * (`/myfleet`, `/trips`, `/municipal-routes`): it requests page-size=100, reads
 * pagination.total_pages, then fetches pages 2..total_pages and concatenates.
 *
 * This guard proves the fetch-all wiring is LIVE on the My Fleet page — the list
 * call carries the kebab page params at the size=100 server max, and the page
 * renders without an uncaught error. (The driver test account's fleet is small —
 * typically one page — so this verifies wiring + render, not the multi-page
 * concatenation, which only triggers for a large account.)
 */
test("My Fleet loads via the fetch-all paginated /myfleet call", async ({ page, pageErrors }) => {
  const fleetCalls: string[] = []
  page.on("request", (req) => {
    const u = req.url()
    if (req.method() === "GET" && /\/myfleet\b/.test(u)) fleetCalls.push(u)
  })

  await page.goto("/portal/fleet")
  await expect(page.locator("aside").first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole("heading", { name: "My fleet" }).first()).toBeVisible({ timeout: 20_000 })
  await page.waitForLoadState("networkidle").catch(() => {})
  await page.waitForTimeout(1000)

  console.log(`[pagination] /myfleet calls: ${fleetCalls.length} — ${fleetCalls.join(", ")}`)
  expect(fleetCalls.length, "expected at least one /myfleet list call").toBeGreaterThan(0)
  expect(
    fleetCalls.some((u) => u.includes("page-number=1") && /page-size=100\b/.test(u)),
    "fetch-all should request /myfleet with page-number=1 & page-size=100",
  ).toBe(true)
  expect(pageErrors, `uncaught errors: ${pageErrors.join(" | ")}`).toEqual([])
})
