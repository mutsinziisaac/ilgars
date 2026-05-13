// RT-01 (designated heavy routes) + RT-02 (port-of-Maputo corridor) registry.
// Backs the unified route picker in the RESTRICTED_HEAVY application flow.

export type RouteCategory = "DESIGNATED" | "PORT_CORRIDOR" | "OTHER"

export type Route = {
  routeCode: string
  routeName: string
  routeCategory: RouteCategory
  bidirectional: boolean
  /** Optional human-readable note shown in the picker. */
  note?: string
}

// RT-01 — Designated Heavy Routes (NIGHT_RESTRICTED whitelist).
const DESIGNATED_ROUTES: Route[] = [
  { routeCode: "RT-D-01", routeName: "Av. de Namaacha", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-02", routeName: "Av. da União Africana", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-03", routeName: "Av. da ONU", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-04", routeName: "Av. 25 de Setembro", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-05", routeName: "Av. 10 de Novembro", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-06", routeName: "Av. da Marginal", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-07", routeName: "Av. Mártires de Inhaminga", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-08", routeName: "Av. Guerra Popular", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-09", routeName: "Av. de Angola", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-10", routeName: "Av. Fernão de Magalhães", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-11", routeName: "Av. do Trabalho", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-12", routeName: "Av. Acordos de Lusaka", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-13", routeName: "Av. Forças Populares", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-14", routeName: "Av. Maria de Lurdes Mutola", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-15", routeName: "Av. 19 de Outubro", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-16", routeName: "Ext. Julius Nyerere", routeCategory: "DESIGNATED", bidirectional: true, note: "Extension segment" },
  { routeCode: "RT-D-17", routeName: "Ext. Carlos Morgado", routeCategory: "DESIGNATED", bidirectional: true, note: "Extension segment" },
  { routeCode: "RT-D-18", routeName: "Ext. Sacadura Cabral", routeCategory: "DESIGNATED", bidirectional: true, note: "Extension segment" },
  { routeCode: "RT-D-19", routeName: "Praça Robert Mugabe", routeCategory: "DESIGNATED", bidirectional: true },
  { routeCode: "RT-D-20", routeName: "Praça dos Trabalhadores", routeCategory: "DESIGNATED", bidirectional: true },
]

// RT-02 — Port of Maputo corridor (fee-exempt for port-bound traffic).
const PORT_CORRIDOR_ROUTES: Route[] = [
  { routeCode: "RT-P-01", routeName: "Av. Mártires de Inhaminga (port leg)", routeCategory: "PORT_CORRIDOR", bidirectional: true, note: "Port-bound segment" },
  { routeCode: "RT-P-02", routeName: "Av. 25 de Setembro · ONU↔Guerra Popular", routeCategory: "PORT_CORRIDOR", bidirectional: true, note: "Bounded segment" },
  { routeCode: "RT-P-03", routeName: "Av. da União Africana (port leg)", routeCategory: "PORT_CORRIDOR", bidirectional: true },
  { routeCode: "RT-P-04", routeName: "Av. das Estâncias", routeCategory: "PORT_CORRIDOR", bidirectional: true },
  { routeCode: "RT-P-05", routeName: "Av. da ONU (port leg)", routeCategory: "PORT_CORRIDOR", bidirectional: true },
  { routeCode: "RT-P-06", routeName: "EN1 / EN4 (within municipal territory)", routeCategory: "PORT_CORRIDOR", bidirectional: true, note: "National roads inside Maputo" },
]

// Synthetic off-list option — selecting it opens the map placeholder and routes
// the operator to the EXCEPTIONAL flow.
export const OFF_LIST_ROUTE: Route = {
  routeCode: "RT-X-OFFLIST",
  routeName: "Other route — pick on map",
  routeCategory: "OTHER",
  bidirectional: false,
  note: "Triggers the exceptional authorisation workflow",
}

const ALL_ROUTES: Route[] = [
  ...DESIGNATED_ROUTES,
  ...PORT_CORRIDOR_ROUTES,
  OFF_LIST_ROUTE,
]

export function getRoutes(): Route[] {
  return ALL_ROUTES
}

export function getDesignatedRoutes(): Route[] {
  return DESIGNATED_ROUTES
}

export function getPortCorridorRoutes(): Route[] {
  return PORT_CORRIDOR_ROUTES
}

export function lookupRoute(code: string): Route | undefined {
  return ALL_ROUTES.find((r) => r.routeCode === code)
}

export function isOffListRoute(route: Route | null): boolean {
  return !!route && route.routeCode === OFF_LIST_ROUTE.routeCode
}
