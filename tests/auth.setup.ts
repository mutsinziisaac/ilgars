import { test as setup, expect } from "@playwright/test"
import path from "path"

/**
 * Test auth for the ILGARS Transporter Portal.
 *
 * The app uses keycloak-js with `onLoad: "login-required"`, which keeps tokens
 * in memory (NOT storage) and redirects to the Keycloak login page. So unlike a
 * storage-seeding approach, we log in for real ONCE here, filling the Keycloak
 * form, then persist storageState. The persisted KC SSO cookie (on the auth
 * domain) lets every later spec re-authenticate silently: keycloak-js redirects
 * to the authorize endpoint, KC sees the SSO session and returns a code with no
 * login form.
 *
 * Credentials come from env only (tests/.env.local) — never committed. The
 * transporter portal expects a driver/transporter account.
 */

const STORAGE_STATE = path.resolve(process.cwd(), "tests/.auth/user.json")
const USERNAME = process.env.E2E_USERNAME ?? ""
const PASSWORD = process.env.E2E_PASSWORD ?? ""

setup("authenticate via Keycloak", async ({ page }) => {
  expect(USERNAME, "Set E2E_USERNAME in tests/.env.local (a driver/transporter UAT account)").not.toBe("")
  expect(PASSWORD, "Set E2E_PASSWORD in tests/.env.local").not.toBe("")

  // keycloak-js (login-required) redirects the protected /portal to the KC login page.
  await page.goto("/portal")
  await page.waitForURL(/\/realms\/ilgars\/protocol\/openid-connect\/auth/, { timeout: 30_000 })

  // #username/#password are kept by the custom Keycloakify theme, but the submit
  // button is a themed <button type="submit"> ("Sign In"), not the base #kc-login.
  // Match either so the harness survives a theme swap / realm locale change.
  await page.locator("#username").fill(USERNAME)
  await page.locator("#password").fill(PASSWORD)
  await page.locator('#kc-login, button[type="submit"], input[type="submit"]').first().click()

  // Back on the portal and authenticated: the app shell (sidebar <aside>) renders.
  await page.waitForURL(/\/portal/, { timeout: 30_000 })
  await expect(page.locator("aside").first()).toBeVisible({ timeout: 30_000 })

  await page.context().storageState({ path: STORAGE_STATE })
})
