/**
 * The authenticated portal pages (React Router routes under /portal) and a
 * stable marker proving each rendered. Markers are derived from the top-bar
 * (heading) / page body copy in src/i18n/locales/en.ts — see top-bar.tsx.
 */
export interface NavTarget {
  key: string
  path: string
  marker: { kind: "heading" | "main" | "header"; text: string }
}

export const NAV_TARGETS: NavTarget[] = [
  { key: "overview", path: "/portal", marker: { kind: "main", text: "Fleet at a glance" } },
  { key: "fleet", path: "/portal/fleet", marker: { kind: "heading", text: "My fleet" } },
  { key: "permits", path: "/portal/permits", marker: { kind: "heading", text: "My permits" } },
  { key: "transactions", path: "/portal/transactions", marker: { kind: "header", text: "Transactions" } },
  { key: "pay-charges", path: "/portal/pay-charges", marker: { kind: "main", text: "Lookup vehicle" } },
  { key: "reports", path: "/portal/reports", marker: { kind: "main", text: "Reports" } },
  { key: "fleet-new", path: "/portal/fleet/new", marker: { kind: "heading", text: "Register a new vehicle" } },
]
