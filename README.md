# Maputo RUC — Transporter Portal (ILGARS)

Web portal for transporters operating heavy goods vehicles in the Municipality of Maputo, Mozambique. The portal is the operator-facing surface of the Maputo Road User Charges (RUC) system: it lets a registered transporter manage their fleet, view and pay road user charges and circulation licences, request road closure / partial restriction permits, top up a wallet, and see real-time compliance status for every truck in their fleet.

This repository implements the **Transporter Portal** only. Sibling surfaces (City Authority enforcement console, Driver mobile QR tool, System Administrator console) are out of scope for this codebase.

---

## 1. What this app is for

The Maputo City Council levies Road User Charges on commercial vehicles (>8,000 kg GVW) operating inside the city. Until now, payment, declaration, and compliance verification have been manual. The RUC system digitises the full lifecycle: vehicle registration, fee calculation, multi-channel payment, permit issuance, and real-time GPS-based enforcement. This portal is how transporters interact with that system.

**Primary jobs the portal must do well:**

1. **Onboard a transporter** using their Chest ID, company name, email, phone, and country (UC-001).
2. **Register and manage trucks** linked to the transporter, pulling logbook/axle/plate data from the MVR API where available (UC-002).
3. **Show fleet compliance at a glance** — paid / unpaid / expired / renewal-due, with the active trip for each truck.
4. **Pay Road User Charges** through Mobile Money, Bank Transfer, Card, or Wallet (UC-003).
5. **Pay Circulation Licence fees** per the weight-tiered tariff (UC-004), with a 20,000 MZN monthly cap.
6. **Apply for and pay Road Closure permits** at hourly rates by purpose × road class (UC-005).
7. **Apply for and pay Partial Road Restriction permits** at hourly rates by purpose × road class (UC-006).
8. **Display QR-verifiable receipts** that a roadside officer can scan to confirm compliance (supports UC-007).
9. **Surface "what needs attention"** — upcoming renewals, awaiting payment, available receipts.
10. **Show wallet balance and a top-up flow.**

All amounts are in **MZN (Mozambique Metical)**. The locale is Mozambique; the primary content language is Portuguese (e.g. "Boa tarde, Trans Limpopo"). UI labels are short-form English by default — keep copy ready to be translated.

---

## 2. User roles supported by *this portal*

Only the **Transporter** role logs into this portal. The other roles in the spec exist in sibling apps:

| Role | Where they live | What they do |
|---|---|---|
| **Transporter (Truck Owner / Operator)** | **This portal** | Manage company profile (Chest ID), add/remove trucks, top up wallet, pay RUC, apply for permits, generate reports. |
| Driver | Mobile app | Print/show RUC QR code, close trips. |
| City Authority Staff | Enforcement console | Scan QR, generate penalties, generate reports. |
| System Administrator | Admin console | Configure tariffs, integrations, roles. |

If you're tempted to build a screen for a non-transporter role here, stop and check with the user first — it almost certainly belongs in another repo.

---

## 3. Domain rules every contributor must respect

The reference docs are authoritative; this section is a quick map. When in doubt, defer to the source documents listed in §10.

### 3.1 Identity and registration

- The transporter's **Chest ID is the primary identifier** (BR-001-01). Treat it as a unique key; reject duplicates.
- Email validation is RFC 5322 (BR-001-02). An email cannot be reused across accounts.
- Registration is **not complete until email verification** (BR-001-04). Until then, treat the account as pending and gate access.
- A truck can only be registered by a transporter who has finished UC-001 (BR-002-01).
- Number plates are unique (BR-002-04). Photos are JPEG/PNG, max 5 MB each (BR-002-03).
- Pull logbook, axle count, and number plate from the **MVR API** when connectivity exists; fall back to manual entry (BR-002-02). Auto-populated fields should be visually distinguishable from user-entered ones.

### 3.2 Circulation Licence fees (UC-004) — weight-tiered, MZN

| Category | Daily rate (MZN) |
|---|---|
| Agricultural Transit (monthly authorisation) | 1,000 × days |
| Cargo 8,000–16,000 kg | 1,000 × days |
| Cargo 16,001–25,000 kg | 2,000 × days |
| Cargo 25,001–38,000 kg | 3,000 × days |
| Cargo 38,001–48,000 kg | 4,000 × days |
| Cargo > 48,001 kg | 5,000 × days |
| Daily Authorisation (non-authorised roads) | 1,000 × days |
| Special Circulation Licence | 20,000 / month (flat) |

**Hard caps and rules:**
- Monthly cap across all weight categories: **20,000 MZN** (BR-004-05). The fee calculator must honour this cap when payments are monthly.
- Weight class must be validated against the MVR/registered truck profile (BR-004-06).
- Block duplicate licence purchase while an active licence covers the same period (BR-004-07).

### 3.3 Road Closure (UC-005) and Partial Restriction (UC-006) — hourly, by purpose × road class

Total fee = **hourly rate × hours**. Road class is one of `Protocol`, `Secondary`, `Tertiary`. Road class must be validated against the GIS / road registry before fee determination.

**UC-005 Full Closure (MZN/hour):**

| Purpose | Protocol | Secondary | Tertiary |
|---|---:|---:|---:|
| Construction Works | 50,000 | 30,000 | 15,000 |
| Filming | 50,000 | 30,000 | 20,000 |
| Sporting Events | 10,000 | 5,000 | 3,500 |
| Fairs | 2,000 | 1,000 | **0** |
| For-Profit Events | 40,000 | 20,000 | 10,000 |

**UC-006 Partial Restriction (MZN/hour):**

| Purpose | Protocol | Secondary | Tertiary |
|---|---:|---:|---:|
| Construction Works | 10,000 | 5,000 | 3,500 |
| Filming | 40,000 | 30,000 | 20,000 |
| Sporting Events | 5,000 | 3,500 | 1,800 |
| Fairs | 2,000 | 1,000 | **0** |
| For-Profit Events | 20,000 | 10,000 | 5,000 |

A 0 MZN category (e.g. Fairs on Tertiary) still issues a permit, just without payment. The permit is invalid until payment is confirmed for paid categories. Approval flow happens **before** payment — never collect money on a request that hasn't been approved.

### 3.4 Compliance and the CityPresenceTransaction

The system is built around a transaction-centric model (see *Untitled.txt* spec, §14). Anything the portal shows about "what is owed" or "what is paid" must reflect the **transaction balance**, not a licence balance (FE-06).

Critical rules to surface correctly in UI:

- **Vehicle status** is one of `Compliant (Paid)`, `Renewal soon`, `Non-compliant (Unpaid)`, `Expired`, or `Disputed`. The portal's chips and badges must map exactly to these states — don't invent new ones.
- **TX-08 prepaid expiry rollover**: if a prepaid licence expires while the vehicle is still in the city, the transaction flips to `OPEN_POSTPAID` and daily charges accrue. Notify the owner. UI must clearly distinguish "renewal upcoming" from "already accruing daily charges".
- **TX-21 continued presence**: settling a postpaid transaction is *retrospective only* — it covers up to the settlement timestamp. If the vehicle stays in the city past the rollover boundary (default policy: strict / next-day boundary), a new transaction opens automatically. The portal must show the chain of transactions for a vehicle, linked via `precedingTransactionId`.
- **Exit-block at checkpoints**: a vehicle with `balanceDue > 0` cannot cleanly exit; the portal must surface `PENDING_SETTLEMENT` urgently when this happens.

### 3.5 Payment channels

Supported channels (BR-003-x, BR-004-x, BR-005-x, BR-006-x): **Mobile Money, Bank Transfer, Card, Wallet, Agent (over-the-counter)**. Every payment must produce a digital receipt with a unique receipt number, timestamp, and amount. Receipts are deliverable as on-screen, PDF, SMS, and email — design every receipt-bearing screen with all four delivery routes in mind.

### 3.6 Audit and security floor

- All payment / enforcement / state-change actions must be auditable (BR-003-06, BR-007-03, TX-20). Don't add UI affordances that mutate state without producing an audit-trail record on the backend.
- Real-time integration between payment and enforcement is required (BR-007-05). When a payment succeeds in the UI, treat compliance status as eventually consistent — show a clear "updating compliance" state if the enforcement feed hasn't caught up.
- TLS 1.2+, bcrypt-hashed credentials, WCAG 2.1 AA, 7-year financial retention. The frontend is bound by the WCAG and TLS requirements directly.

---

## 4. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | React 19 + TypeScript | Strict mode on. |
| Bundler / dev server | Vite 7 | `npm run dev`, `npm run build`. |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) | No `tailwind.config.js` — theme lives in `src/index.css` `@theme inline`. |
| Component primitives | shadcn/ui (`components.json`, `baseColor: olive`) layered on Radix UI + Base UI | Add components with `npx shadcn@latest add <name>`. |
| Icons | `lucide-react` | |
| Charts | `recharts` | Used for the dashboard "Spending · 6 months" chart. |
| Forms / inputs | `react-day-picker`, `input-otp`, `cmdk`, `vaul`, `embla-carousel-react`, `react-resizable-panels` | |
| Toasts | `sonner` | |
| Theming | `next-themes` + `<ThemeProvider>` toggling `.dark` on `<html>` | Default: system. Keyboard shortcut: `d`. |
| Date | `date-fns` | |
| Lint / format | ESLint 9, Prettier 3 (`prettier-plugin-tailwindcss`) | |

### 4.1 Design tokens

All theme tokens live in **`src/index.css`** as CSS custom properties under `:root` (light) and `.dark` (dark). The token *structure* matches the shadcn convention; the *values* implement the Maputo RUC visual identity:

- **Background**: warm cream (`oklch(0.973 0.012 90)`)
- **Cards**: pure white
- **Primary**: deep forest green — used for the primary CTA ("New trip"), the fleet-status strip, and the active month in the spending chart
- **Secondary**: amber / gold — used for "Top up wallet", brand avatar, active sidebar marker, status-strip labels
- **Sidebar**: deep forest green panel; the wallet card uses an even darker green (`--sidebar-accent`)
- **Accent**: pale cream chip — used for "Renewal soon" pills and hover surfaces
- **Chart palette** (`--chart-1` → `--chart-5`): pale mint → deep forest green
- **Radius**: base `0.625rem`, scale from `--radius-sm` (60%) up to `--radius-4xl` (260%)
- **Font**: `Outfit Variable` for both `--font-sans` and `--font-heading`

If you need a new colour, add a new semantic token and consume it via Tailwind utility — **never hard-code hex / oklch values inside components**.

---

## 5. Project layout

```
src/
  components/
    ui/                 # shadcn primitives — generated, edit with care
    theme-provider.tsx  # next-themes wrapper; toggles `.dark` on <html>
  App.tsx
  main.tsx
  index.css             # Tailwind v4 entrypoint + design tokens
public/
components.json         # shadcn config (cssVariables: true, baseColor: olive)
vite.config.ts
```

---

## 6. Scripts

```bash
npm install           # install dependencies
npm run dev           # start Vite dev server
npm run build         # tsc -b && vite build  (run before any PR)
npm run typecheck     # tsc --noEmit
npm run lint          # eslint .
npm run format        # prettier --write "**/*.{ts,tsx}"
npm run preview       # preview production build
```

`npm run build` is the floor for "is this branch shippable". Type errors fail the build.

### 6.1 Authentication and API calls

The portal requires Keycloak before rendering protected routes. Create a local
`.env.local` from `.env.example` and set:

```bash
VITE_KEYCLOAK_URL=
VITE_KEYCLOAK_REALM=
VITE_KEYCLOAK_CLIENT_ID=
VITE_API_BASE_URL=
```

Future backend calls should go through `apiRequest` from `src/lib/api.ts` inside
TanStack Query query/mutation functions. The shared client refreshes the
Keycloak token before each protected request and sends it as
`Authorization: Bearer <jwt>`.

---

## 7. Rules of engagement (engineers and agents)

These are non-negotiable unless the user explicitly relaxes them in a given task.

### 7.1 Token and styling rules

1. **Never hard-code colours, radii, fonts, or shadows in components.** Use the semantic tokens (`bg-primary`, `text-muted-foreground`, `rounded-lg`, etc.) so that re-theming stays a one-file change.
2. **Don't introduce a `tailwind.config.js`.** This project is Tailwind v4 — theme lives in `@theme inline` inside `src/index.css`.
3. **Don't fork shadcn primitives.** If you need to extend a `ui/` component, compose it from outside or pass props; only edit `src/components/ui/*` when the upstream pattern explicitly says to.
4. **Every status, badge, and chip must map to a domain state from §3.4.** Don't invent UI states the backend cannot produce.

### 7.2 Domain rules

5. **Treat the spec as authoritative.** The `Maputo_RUC_User_Requirement_Specification`, `Maputo RUC-Use Cases V3`, and `Untitled.txt` (Business Rules v4) documents are the source of truth. If a UI proposal contradicts them, raise it before implementing.
6. **All money is MZN, formatted with thousands separators (e.g. `15,000 MZN`).** Use a single helper for formatting; don't sprinkle `Intl.NumberFormat` calls.
7. **Surface compliance state honestly.** Don't show "Compliant" while a payment is reconciling — show a transient state. Don't hide `PENDING_SETTLEMENT`; that's a critical UX signal.
8. **Don't bypass the approval gate** for road closure / restriction permits. Payment screens for UC-005 / UC-006 must be unreachable until the city authority approves.

### 7.3 Code rules

9. **No new dependencies without a clear reason.** The stack already covers forms, charts, dates, and animations. Justify additions in the PR description.
10. **No mock data committed to `main`.** Use fixtures kept under a `__mocks__` or `fixtures/` folder, gated behind a dev-only import or env flag.
11. **No `any` in new code.** Tighten existing `any` opportunistically when you're already in the file.
12. **Prefer editing existing files over creating new ones.** Don't sprawl the structure — feature folders only when there's clearly more than one screen for that feature.
13. **Don't add comments that restate the code.** Add a comment only when the *why* is non-obvious (a hidden constraint, a cap, a workaround).
14. **Accessibility is a build requirement, not a polish step** (WCAG 2.1 AA). All interactive elements need keyboard reachability, visible focus, and labels. Use the Radix / Base UI primitives — they handle most of this.

### 7.4 Process rules

15. **Run `npm run build` before reporting a task as done.** Type-check + bundle is the minimum. For UI work, also load the page in a browser and verify the golden path.
16. **Don't commit unless asked.** Don't push, force-push, or create PRs autonomously. The user opens commits, PRs, and merges.
17. **Don't run destructive git commands** (`reset --hard`, `clean -f`, branch deletion) without explicit confirmation.
18. **Don't add CI, hooks, or `.github/` workflows** without an explicit ask.
19. **For agent runs:** read the spec first, then plan, then implement. If a domain rule is unclear, stop and ask — don't guess at fee tables.

### 7.5 Anti-patterns to avoid

- "Smart" wrappers around shadcn primitives that hide their props.
- Storing tariffs as hard-coded constants scattered across components — they belong in a single `tariffs.ts` reference module so they can be regenerated when the municipality amends Annex I.
- Boolean flags in URL state that conflate "loading" with "empty" with "error". Keep these as explicit discriminated unions.
- Hiding empty states. A transporter with zero trucks still needs a meaningful empty screen with a primary action.
- Treating "Renewal in 4 days" as a free-form string. It's derived from `validTo - now`; render it through a single helper.

---

## 8. Adding a shadcn component

```bash
npx shadcn@latest add button
```

Files land in `src/components/ui/`. Don't rename them. If you need a domain wrapper, put it in `src/components/<feature>/` and import the primitive.

---

## 9. Browser / device targets

- **Desktop-first** (this is a back-office portal). Layout breaks below ~1024 px are acceptable v1; document them. Mobile is a future scope item; don't pre-optimise.
- **Modern evergreen browsers** (Chrome, Edge, Safari, Firefox latest two majors).
- The Driver experience (QR scanning, trip closure) is **not** part of this codebase.

---

## 10. Source documents (authoritative)

These live outside the repo. When implementing or reviewing a feature, cross-check against:

- `Maputo_RUC_User_Requirement_Specification` — UC-001 through UC-007, integration list, NFRs.
- `Maputo RUC-Use Cases V3` — narrative use cases, role list, escalation paths.
- `Untitled.txt` (Business Rules v4) — Heavy Vehicle Circulation Licence: vehicle classification thresholds, access decision matrix, route rules, time windows, GPS telematics, and the CityPresenceTransaction lifecycle (including TX-21 continued-presence rollover).

If these documents disagree, the **Business Rules v4** spec wins on transaction lifecycle and enforcement; the **URS** wins on user-facing inputs/outputs/business rules numbered `BR-xxx-xx`. Where genuine ambiguity exists (see §11 of the v4 spec), surface it to the user before encoding a choice in the UI.

---

## 11. Glossary

- **Chest ID** — Unique identifier issued to a transporter; primary key for accounts.
- **MVR** — Motor Vehicle Registry; the upstream system for logbook, axles, plates.
- **MZN** — Mozambique Metical; all amounts.
- **Annex I** — The fee tariff table, versioned reference data.
- **GVW** — Gross Vehicle Weight (kg).
- **Designated Heavy Route** — One of the avenues whitelisted for `NIGHT_RESTRICTED` movement (RT-01).
- **Port Corridor** — Routes exempt from time/route restriction for Port-of-Maputo-bound traffic (RT-02).
- **OPEN_PREPAID / OPEN_POSTPAID / SETTLED / CLOSED / DELINQUENT / PENDING_SETTLEMENT / DISPUTED** — Transaction states. The portal must render each one distinguishably.
- **TX-08** — Prepaid expiry rollover (prepaid → postpaid while still in city).
- **TX-21** — Continued-presence rollover (settled postpaid + still in city → new postpaid transaction chained via `precedingTransactionId`).
