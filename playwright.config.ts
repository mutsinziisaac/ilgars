import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"
import path from "path"

// Load test secrets/config from the gitignored tests/.env.local (see tests/.env.example).
dotenv.config({ path: path.resolve(process.cwd(), "tests/.env.local") })

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173"
const STORAGE_STATE = path.resolve(process.cwd(), "tests/.auth/user.json")

export default defineConfig({
  testDir: "./tests",
  // Runs against live UAT through the Vite dev proxy. Serial so the single
  // Keycloak SSO session (captured once by the setup project) covers the run.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // 1) Log in via Keycloak ONCE and persist the session (incl. the KC SSO
    //    cookie on the auth domain) to storageState.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    // 2) Every spec reuses that session; keycloak-js then silently re-auths via
    //    the login-required redirect (SSO cookie → code → token, no form).
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
  // Reuse the dev server if it's already running; otherwise start one.
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
