# CLAUDE.md — ILGARS Customer UI (Transporter Portal)

Guidance for Claude Code in the **ILGARS customer-facing web app** — the transporter/driver portal. Repo `road-user-charge/ilgars`; deploys on **Vercel from `main`** → **`ilgars.ayinza.com`**. Backend + cross-repo context: workspace `../.claude/CLAUDE.md` (auto-loaded) + `../AGENTS.md` + session memory. **Keep this file current.**

## What it is

React 19 · Vite 7 · TypeScript · TailwindCSS 4 · shadcn/radix · TanStack Query v5 · React Router 7 · **keycloak-js** · zod · i18next (en + **pt-MZ**). Talks to live UAT (`ilgars.ayinza.dev`) via the Vite dev proxy (`/core/api`, `/motorvehicle`). The sibling admin dashboard is `../ilgars_admin_console`.

- **Routing:** `/` = public prepaid-trip landing (no auth); everything else is under `/portal/*` (wrapped in `AuthProvider` + `AppLayout`): overview, fleet, fleet/new, fleet/:id, pay-charges, permits, transactions, reports.
- **Auth:** keycloak-js, realm `ilgars`, client `ilgars-ui`, `onLoad: login-required` (redirect; tokens in memory — NOT storage).
- **Pagination:** `fetchAllPages` (`src/lib/pagination.ts`) fetches all pages of `/myfleet`, `/trips`, `/municipal-routes` (`page-number`/`page-size`, size=100). NOTE the devices service uses `page`/`size` and is unpaged.

## Run / build (⚠ typecheck gotcha)

```bash
npm install
npm run dev        # http://localhost:5173 (shared port with the admin console — run one at a time)
npm run build      # tsc -b && vite build  (the real gate; Vercel runs this)
npm run typecheck  # tsc -b --noEmit  — MUST be build-mode
```

- **`typecheck` MUST be `tsc -b --noEmit`, not `tsc --noEmit`.** Root `tsconfig.json` is a solution-style stub (`"files": []` + `references`); plain `tsc --noEmit` checks ZERO files (false-green). Only build mode descends into `tsconfig.app.json`. (Fixed 2026-06-22.)

## Playwright (`tests/`, added 2026-06-22)

Authenticated smoke + health vs **live UAT**. Auth = a `setup` project that does a REAL Keycloak form login once and saves `storageState` (the KC SSO cookie) → specs re-auth silently (keycloak-js redirect → SSO → code, no form; storage-seeding can't work since tokens are in-memory). See README §6.2.

```bash
npx playwright install chromium
cp tests/.env.example tests/.env.local   # driver/transporter UAT creds (E2E_USERNAME/E2E_PASSWORD)
npm run test:e2e
```

- Specs: `smoke` (7 portal pages render), `api-health` (no 5xx), `pagination` (`/myfleet` fetch-all), `landing` (public). 11/11 green.
- Creds in `tests/.env.local` (gitignored via `*.local`); `tests/.auth/` gitignored (holds a real token). NEVER commit either.

## Norms

- Match existing style (Prettier). Commit/push only when asked; pushes need explicit per-action confirmation. `main` deploys to prod via Vercel.
- Run `npm run build` (and the e2e suite where behavior could change) before any push.
