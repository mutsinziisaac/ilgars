# ILGARS Frontend — API Reference

This document inventories every HTTP endpoint the ILGARS frontend currently calls. It is derived from the API client files under `src/lib/` and is intended as a contract reference for backend, QA, and new frontend engineers.

**Sources of truth:**

- `src/lib/api.ts` — generic `apiRequest<T>` wrapper, `ApiError`, base-URL resolution
- `src/lib/trips-api.ts` — trips, municipal routes, RUC policies, road closure permits, special permit route requests
- `src/lib/fleet-vehicles-api.ts` — myfleet / fleet vehicles
- `src/lib/motor-vehicle-api.ts` — motor vehicle logbook
- `src/lib/auth.ts` — Keycloak authentication
- `.env` — base URL and configuration

---

## Table of Contents

- [Overview](#overview)
- [Conventions](#conventions)
- [Authentication (Keycloak)](#authentication-keycloak)
- [Core API](#core-api)
  - [Trips](#trips)
  - [Municipal Routes](#municipal-routes)
  - [RUC Policies](#ruc-policies)
  - [Road Closure Permits](#road-closure-permits)
  - [Special Permit Route Requests](#special-permit-route-requests)
  - [MyFleet / Fleet Vehicles](#myfleet--fleet-vehicles)
- [Motor Vehicle API](#motor-vehicle-api)
- [Shared Type Reference](#shared-type-reference)
- [Page → Endpoint Usage Map](#page--endpoint-usage-map)

---

## Overview

The frontend talks to three backends:

| Service              | Base URL (env)                                                          | Env Var                            |
| -------------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| Core API             | `https://ilgars.ayinza.dev/core/api/v1`                                  | `VITE_API_BASE_URL`                |
| Motor Vehicle API    | `https://ilgars.ayinza.dev/motorvehicle/api/v1`                          | `VITE_MOTOR_VEHICLE_API_BASE_URL`  |
| Keycloak (Auth)      | `https://auth-rtms.ayinza.dev` — realm `ilgars`, client `ilgars-ui`      | `VITE_KEYCLOAK_*`                  |

`resolveApiBaseUrl()` (`src/lib/api.ts:132`) extracts the path portion of a fully qualified base URL — so in production the frontend issues requests against paths like `/core/api/v1/trips`, which Vercel proxies to the absolute origin.

The municipality scope for most Core API requests is supplied via `VITE_MUNICIPALITY_ID` (e.g. `aa73ac5e-4912-460f-a927-ba3ccbe57207`).

---

## Conventions

### Response wrapping

Many Core API responses arrive either as the raw value `T` or wrapped as `{ data: T }`. The client normalizes both via `unwrap<T>()` (defined in `src/lib/trips-api.ts:241` and `src/lib/fleet-vehicles-api.ts:111`):

```ts
type Wrapped<T> = T | { data: T }
```

This document shows each response as `Wrapped<T>`; consumers should expect either shape.

### Request wrapping

POST bodies are always wrapped: the client sends `{ data: <payload> }`. For example, `createTrip(payload)` issues a request body of:

```json
{ "data": { "vehicleId": "...", "municipalityId": "...", ... } }
```

### Authentication header

`apiRequest()` (`src/lib/api.ts:188`) attaches `Authorization: Bearer <token>` from the configured access-token provider on every request, **unless** the caller passes `skipAuth: true`. The token is obtained from Keycloak (`refreshKeycloakToken()` in `src/lib/auth.ts:185`) with a 30-second minimum validity refresh.

### Plate normalization

Plate lookups go through `compactPlateNumber()` (`src/lib/motor-vehicle-api.ts:58`):

```ts
plate.toUpperCase().replace(/[^A-Z0-9]/g, "")
```

So `"abc 123-x"` is sent as `"ABC123X"`.

### Errors

Non-2xx responses throw `ApiError` (`src/lib/api.ts:9`) carrying `status`, `statusText`, the parsed `body`, and `url`. `getApiErrorMessage(error, fallback)` (`src/lib/api.ts:103`) deep-inspects the body to surface a user-readable message (looks for `message`, `detail`, `title`, `description`, `error`, or recurses into `data`/`errors`).

---

## Authentication (Keycloak)

The frontend uses [keycloak-js](https://www.npmjs.com/package/keycloak-js) with PKCE S256 and `onLoad: "login-required"` (`src/lib/auth.ts:162`). There are no custom HTTP endpoints — all auth flows are handled by the Keycloak SDK against the configured realm.

| Operation         | Mechanism                              |
| ----------------- | -------------------------------------- |
| Login             | `keycloak.init({ onLoad: "login-required" })` then `keycloak.login()` |
| User profile      | `keycloak.loadUserProfile()`           |
| Token refresh     | `keycloak.updateToken(30)`             |
| Logout            | `keycloak.logout()` / `keycloak.clearToken()` |

Resolved claims used by the app: `sub`, `preferred_username`, `email`, `given_name`, `family_name`, `name`, `email_verified`, plus the custom `chest_id` / `chestId`.

---

## Core API

Base URL: `https://ilgars.ayinza.dev/core/api/v1`

### Trips

Source file: `src/lib/trips-api.ts`

---

#### GET `/trips?vehicleId={vehicleId}`

List all trips for a single vehicle.

- **Auth:** Bearer required
- **Caller:** `getTripsByVehicleId(vehicleId)` (`src/lib/trips-api.ts:306`) — alias `listTripsByVehicle()` (`src/lib/trips-api.ts:450`)
- **Used by:** `src/pages/vehicle-detail.tsx`

**Query parameters**

| Name        | Type   | Required | Notes                       |
| ----------- | ------ | -------- | --------------------------- |
| `vehicleId` | string | yes      | URL-encoded vehicle UUID    |

**Request body:** none

**Response body**

```ts
// Wrapped<VehicleTrip[]>
type VehicleTrip = {
  billingStatus: string
  createdBy: string
  creationSource: string
  expectedDurationDays: number
  feeCount: number
  id: string
  municipalityId: string
  outstandingFeeAmount: number
  paidFeeAmount: number
  paymentMode: string
  reason: string
  status: string
  totalFeeAmount: number
  vehicleId: string
  [key: string]: unknown
}
```

---

#### GET `/trips`

List all trips (no filter).

- **Auth:** Bearer required
- **Caller:** `listTrips()` (`src/lib/trips-api.ts:313`)

**Request body:** none

**Response body**

```ts
// Wrapped<TripListItem[]>
type TripListItem = VehicleTrip & {
  createdAt?: string
  enteredAt?: string
  vehicle?: {
    vehicleId?: string
    plateNumber?: string | null
    truckNumber?: string | null
    ownerName?: string | null
    operatorName?: string | null
    capacity?: number | null
    capacityUnit?: string | null
    registryStatus?: string | null
  }
  route?: {
    routeId?: string | null
    id?: string | null
    code?: string | null
    name?: string | null
    selectionStatus?: string | null
  }
  payment?: {
    paymentMode?: string
    totalFeeAmount?: number
    paidFeeAmount?: number
    outstandingFeeAmount?: number
    feeCount?: number
    prn?: string | null
    invoiceId?: string | null
    latestFeeStatus?: string | null
    fees?: Array<{
      amount?: number
      createdAt?: string
      coverageStart?: string
      coverageEnd?: string
      durationDays?: number
      exactMinutes?: number
    }>
  }
}
```

---

#### POST `/trips`

Create an authenticated prepaid trip.

- **Auth:** Bearer required
- **Caller:** `createTrip(payload)` (`src/lib/trips-api.ts:320`) — alias `createPrepaidTrip`
- **Used by:** `src/pages/pay-charges.tsx`

**Request body**

```ts
{
  data: TripCreatePayload
}

type TripCreatePayload = {
  vehicleId: string
  municipalityId: string
  paymentMode: "PREPAID"
  expectedDurationDays: number
  createdBy?: string
  reason?: string
  routeId?: string
}
```

**Response body**

```ts
// Wrapped<TripCreateResult>
type TripCreateResult = {
  trip: VehicleTrip
  fee: TripFee | null
  invoice: TripInvoice | null
  specialPermit: unknown | null
}
```

See [`TripFee`](#tripfee) and [`TripInvoice`](#tripinvoice) in the shared types section.

---

#### GET `/trips/{tripId}`

Fetch a single trip.

- **Auth:** Bearer required
- **Caller:** `getTripDetail(tripId)` (`src/lib/trips-api.ts:356`)

**Path parameters**

| Name     | Type   | Notes                  |
| -------- | ------ | ---------------------- |
| `tripId` | string | URL-encoded trip UUID  |

**Request body:** none

**Response body**

```ts
// Wrapped<VehicleTrip>
```

---

#### POST `/public/prepaid-trips`

Create a prepaid trip without authentication (public landing page flow).

- **Auth:** `skipAuth: true` — no Bearer token sent
- **Caller:** `createPublicPrepaidTrip(payload)` (`src/lib/trips-api.ts:333`)
- **Used by:** `src/pages/public-trip-landing.tsx`

**Request body**

```ts
{
  data: TripCreatePayload  // same shape as POST /trips
}
```

**Response body**

```ts
// Wrapped<TripCreateResult>
```

---

#### GET `/public/prepaid-trips/vehicles/by-plate/{plate}`

Public vehicle lookup by plate (used by the unauthenticated landing page).

- **Auth:** `skipAuth: true`
- **Caller:** `getPublicPrepaidTripVehicleByPlate(plate)` (`src/lib/trips-api.ts:345`)
- **Used by:** `src/pages/public-trip-landing.tsx`

**Path parameters**

| Name    | Type   | Notes                                            |
| ------- | ------ | ------------------------------------------------ |
| `plate` | string | Normalized via `compactPlateNumber()`, URL-encoded |

**Request body:** none

**Response body**

The backend may respond in several shapes (raw logbook, or wrapped under `vehicle` / `logbook` / `motorVehicle`); `normalizePublicPrepaidTripVehicle()` (`src/lib/trips-api.ts:267`) coerces them to a single `MotorVehicleLogbook`:

```ts
// Normalized to MotorVehicleLogbook — see Shared Types
```

---

### Municipal Routes

Source file: `src/lib/trips-api.ts`

---

#### GET `/municipal-routes?municipalityId={id}&allowedUse={use}&active=true`

List active municipal routes for a given allowed-use category.

- **Auth:** Bearer required (or `skipAuth` if caller opts in)
- **Caller:** `listMunicipalRoutes(municipalityId, options)` (`src/lib/trips-api.ts:363`) — convenience wrapper `listRoadClosureRoutes()` calls with `allowedUse: "ROAD_CLOSURE"`
- **Used by:** `src/pages/pay-charges.tsx`, `src/pages/permits.tsx`, `src/pages/public-trip-landing.tsx`

**Query parameters**

| Name             | Type                                 | Required | Default            |
| ---------------- | ------------------------------------ | -------- | ------------------ |
| `municipalityId` | string (UUID)                        | yes      | —                  |
| `allowedUse`     | `"SPECIAL_PERMIT" \| "ROAD_CLOSURE"` | yes      | `"SPECIAL_PERMIT"` |
| `active`         | boolean                              | yes      | `true`             |

**Request body:** none

**Response body**

```ts
// Wrapped<MunicipalRoute[]>
type MunicipalRoute = {
  id: string
  code?: string
  routeName?: string
  name?: string
  routeCode?: string
  roadType?: string
  distanceKm?: number
  allowedUse?: string
  allowedUses?: string[]
  active?: boolean
  geoJson?: string
  [key: string]: unknown
}
```

---

#### GET `/municipal-routes/{routeId}`

Fetch a single municipal route.

- **Auth:** Bearer required
- **Caller:** `getMunicipalRoute(routeId)` (`src/lib/trips-api.ts:384`)
- **Used by:** `src/pages/permits.tsx`

**Path parameters**

| Name      | Type   | Notes                  |
| --------- | ------ | ---------------------- |
| `routeId` | string | URL-encoded route UUID |

**Response body**

```ts
// Wrapped<MunicipalRoute>
```

---

### RUC Policies

Source file: `src/lib/trips-api.ts`

---

#### GET `/ruc-policies?municipalityId={id}&active=true`

Fetch active Road User Charge policies for a municipality. The client picks the first record and exposes it as the active policy.

- **Auth:** Bearer required
- **Caller:** `getActiveRucPolicy(municipalityId)` (`src/lib/trips-api.ts:402`)

**Query parameters**

| Name             | Type          | Required |
| ---------------- | ------------- | -------- |
| `municipalityId` | string (UUID) | yes      |
| `active`         | boolean       | yes (`true`) |

**Response body**

```ts
// Wrapped<RucPolicy[]>  — client returns `list[0] ?? null`
type RucPolicy = {
  id: string
  municipalityId: string
  active: boolean
  gracePeriodHours?: number
  specialPermitCapacityThreshold: number
  specialPermitCapacityUnit: "TONNES" | "KG" | string
  createdAt?: string
  [key: string]: unknown
}
```

---

### Road Closure Permits

Source file: `src/lib/trips-api.ts`

---

#### GET `/road-closure-permits?municipalityId={id}&status={status}`

List road-closure permits filtered by status.

- **Auth:** Bearer required
- **Caller:** `listRoadClosurePermits(municipalityId, status)` (`src/lib/trips-api.ts:412`)
- **Used by:** `src/pages/permits.tsx`

**Query parameters**

| Name             | Type          | Required | Default                      |
| ---------------- | ------------- | -------- | ---------------------------- |
| `municipalityId` | string (UUID) | yes      | —                            |
| `status`         | string        | yes      | `"PENDING_ADMIN_APPROVAL"`   |

**Response body**

```ts
// Wrapped<RoadClosurePermit[]>
type RoadClosurePermit = {
  id: string
  status: string
  municipalityId?: string
  applicantName?: string
  applicantPhone?: string
  purpose?: RoadClosurePurpose | string
  requestedStartAt?: string
  requestedEndAt?: string
  conditions?: string | null
  route?: Partial<MunicipalRoute> & { distanceKm?: number }
  invoice?: RoadClosurePermitInvoice | null
  licence?: {
    licenceType?: string
    licenceNumber?: string
    qrPayload?: unknown
    [key: string]: unknown
  } | null
  [key: string]: unknown
}

type RoadClosurePurpose =
  | "CONSTRUCTION"
  | "FILMING"
  | "SPORTING_EVENT"
  | "PARADE"
  | "PRIVATE_EVENT"
  | "PROTOCOL"
  | "OTHER"

type RoadClosurePermitInvoice = {
  id?: string
  prn?: string
  amount?: number
  totalAmount?: number
  currency?: string
  status?: string
  distanceKm?: number
  durationHours?: number
  ratePerKmHour?: number
  [key: string]: unknown
}
```

---

#### POST `/road-closure-permits`

Submit a new road-closure permit application.

- **Auth:** Bearer required
- **Caller:** `createRoadClosurePermit(payload)` (`src/lib/trips-api.ts:424`)
- **Used by:** `src/pages/permits.tsx`

**Request body**

```ts
{
  data: RoadClosurePermitCreatePayload
}

type RoadClosurePermitCreatePayload = {
  municipalityId: string
  routeId: string
  purpose: RoadClosurePurpose
  requestedStartAt: string  // ISO-8601
  requestedEndAt: string    // ISO-8601
  conditions?: string
  applicantName?: string
  applicantPhone?: string
}
```

**Response body**

```ts
// Wrapped<RoadClosurePermit>
```

---

### Special Permit Route Requests

Source file: `src/lib/trips-api.ts`

---

#### POST `/special-permit-route-requests`

Submit a request for a special-permit route (custom GeoJSON LineString).

- **Auth:** Bearer required
- **Caller:** `createSpecialPermitRouteRequest(payload)` (`src/lib/trips-api.ts:437`)
- **Used by:** `src/pages/pay-charges.tsx`

**Request body**

```ts
{
  data: SpecialPermitRouteRequestPayload
}

type SpecialPermitRouteRequestPayload = {
  vehicleId: string
  municipalityId: string
  paymentMode: "PREPAID"
  expectedDurationDays: number
  routeName: string
  routeGeoJson: {
    type: "Feature"
    geometry: {
      type: "LineString"
      coordinates: [number, number][]   // [lng, lat] pairs
    }
    properties: { name: string }
  }
  requestedBy: string
  notes?: string
}
```

**Response body**

```ts
// Wrapped<SpecialPermitRouteRequest>
type SpecialPermitRouteRequest = {
  id: string
  status: string
  vehicleId: string
  municipalityId: string
  paymentMode: string
  expectedDurationDays: number
  routeName: string
  [key: string]: unknown
}
```

---

### MyFleet / Fleet Vehicles

Source file: `src/lib/fleet-vehicles-api.ts`

---

#### POST `/myfleet`

Register a vehicle to the current user's fleet.

- **Auth:** Bearer required
- **Caller:** `createFleetVehicle(payload)` (`src/lib/fleet-vehicles-api.ts:123`)
- **Used by:** `src/pages/vehicle-new.tsx`

> Note: although the function accepts a full `FleetVehicleRegistrationPayload`, only `vehicleId` is actually sent to the backend — the rest is captured locally as snapshot context.

**Request body**

```ts
{
  data: { vehicleId: string }
}
```

For reference, the locally constructed `FleetVehicleRegistrationPayload` shape is:

```ts
type FleetVehicleRegistrationPayload = {
  vehicleId: string
  plateNumber: string
  truckNumber: string
  ownerName: string
  operatorName: string
  capacitySnapshot: number
  capacityUnit: "TONNES"
  registryStatus: string
  exemptionStatus: string
  compliantForRating: boolean
  source: "OWNER_SELECTED"
}
```

**Response body**

```ts
// Wrapped<MyFleetItem>  — see Shared Types
```

---

#### GET `/myfleet?status={status}`

List the current user's fleet, optionally filtered by status.

- **Auth:** Bearer required
- **Caller:** `getMyFleetVehicles(status)` (`src/lib/fleet-vehicles-api.ts:137`)
- **Used by:** `src/pages/my-fleet.tsx`, `src/pages/vehicle-detail.tsx`

**Query parameters**

| Name     | Type   | Required | Default    |
| -------- | ------ | -------- | ---------- |
| `status` | string | yes      | `"ACTIVE"` |

**Response body**

```ts
// Wrapped<MyFleetItem[]>  — see Shared Types
```

---

#### GET `/fleet-vehicles?status=ACTIVE`

List all active fleet vehicles (non-myfleet, broader fleet listing).

- **Auth:** Bearer required
- **Caller:** `getActiveFleetVehicles()` (`src/lib/fleet-vehicles-api.ts:131`)

**Response body**

```ts
// FleetVehicle[]
type FleetVehicle = {
  addedAt: string
  addedBySubject: string
  capacitySnapshot: number
  capacityUnit: string
  compliantForRating: boolean
  exemptionStatus: string
  fleetId: string
  id: string
  operatorNameSnapshot: string
  ownerNameSnapshot: string
  plateNumberSnapshot: string
  registryStatus: string
  source: string
  status: string
  truckNumberSnapshot: string
  updatedAt: string
  vehicleId: string
}
```

---

## Motor Vehicle API

Base URL: `https://ilgars.ayinza.dev/motorvehicle/api/v1`

Source file: `src/lib/motor-vehicle-api.ts`

---

#### GET `/vehicles/by-plate/{plate}`

Look up a vehicle logbook by plate.

- **Auth:** Bearer required (caller may pass `skipAuth: true` — used by the public landing flow)
- **Caller:** `getVehicleByPlate(plate, { skipAuth })` (`src/lib/motor-vehicle-api.ts:74`)
- **Used by:** `src/pages/pay-charges.tsx`, `src/pages/vehicle-new.tsx`, `src/pages/public-trip-landing.tsx`

**Path parameters**

| Name    | Type   | Notes                                                  |
| ------- | ------ | ------------------------------------------------------ |
| `plate` | string | Normalized via `compactPlateNumber()`, URL-encoded     |

**Response body**

```ts
// MotorVehicleLogbook | { data: MotorVehicleLogbook }
type MotorVehicleLogbook = {
  colour: string | null
  currentLogbookCapacity: number | null
  engineCapacityCc: number | null
  engineCylinders: number | null
  engineNumber: string | null
  exemptionStatus: string | null
  fuelType: string | null
  gearboxDescription: string | null
  gearboxType: string | null
  grossWeightFrontKg: number | null
  grossWeightMiddleKg: number | null
  grossWeightRearKg: number | null
  grossWeightTotalKg: number | null
  id: string
  logbookCapacityKg: number | null
  logbookNumber: string | null
  logbookSeries: string | null
  make: string | null
  model: string | null
  operatorName: string | null
  operatorReference: string | null
  ownerId: string | null
  plateNumber: string
  registrationDate: string | null
  registrationDepartment: string | null
  serviceType: string | null
  status: string | null
  tareWeightKg: number | null
  truckNumber: string | null
  tyreMeasurements: string | null
  vinOrChassis: string | null
  weighbridgeExternalRef: string | null
}
```

---

#### GET `/vehicles?page={page}&size={size}`

Paginated list of motor vehicles (used for development/mock data flows).

- **Auth:** Bearer required
- **Caller:** `listMockVehicles(page, size)` (`src/lib/motor-vehicle-api.ts:99`)

**Query parameters**

| Name   | Type   | Required | Default |
| ------ | ------ | -------- | ------- |
| `page` | number | yes      | `0`     |
| `size` | number | yes      | `100`   |

**Response body**

The client tolerates several pagination envelopes (`unwrapVehicleList()` at `src/lib/motor-vehicle-api.ts:87` flattens them):

```ts
type MotorVehicleListResponse =
  | MotorVehicleLogbook[]
  | {
      data?:
        | MotorVehicleLogbook[]
        | { content?: MotorVehicleLogbook[]; items?: MotorVehicleLogbook[] }
      content?: MotorVehicleLogbook[]
      items?: MotorVehicleLogbook[]
    }
```

---

## Shared Type Reference

These types appear in multiple endpoints above; their full definitions are collected here.

### `TripInvoice`

```ts
type TripInvoice = {
  id?: string
  amount?: number
  totalAmount?: number
  currency?: string
  durationDays?: number
  lines?: unknown[]
  prn?: string
  status?: string
  [key: string]: unknown
}
```

### `TripFee`

```ts
type TripFee = {
  id?: string
  amount?: number
  totalAmount?: number
  status?: string
  [key: string]: unknown
}
```

### `MyFleetItem`

```ts
type MyFleetItem = {
  id: string
  vehicleId: string
  status: string
  vehicle: MyFleetVehicleSnapshot
  trip?: MyFleetTripContext | null
  location?: MyFleetLocationContext | null
  device?: MyFleetDeviceContext | null
  [key: string]: unknown
}

type MyFleetVehicleSnapshot = {
  vehicleId: string
  plateNumber: string
  truckNumber: string | null
  ownerName: string | null
  operatorName: string | null
  capacity: number | null
  capacityUnit: string | null
  registryStatus: string | null
  [key: string]: unknown
}

type MyFleetTripContext = {
  onTrip?: boolean
  tripStatus?: string | null
  tripId?: string | null
  municipalityId?: string | null
  paymentMode?: string | null
  billingStatus?: string | null
  outstandingFeeAmount?: number | null
  totalFeeAmount?: number | null
  paidFeeAmount?: number | null
  expectedDurationDays?: number | null
  [key: string]: unknown
}

type MyFleetLocationContext = {
  hasLocation?: boolean
  source?: string | null
  latitude?: number | null
  longitude?: number | null
  observedAt?: string | null
  [key: string]: unknown
}

type MyFleetDeviceContext = {
  trackerAssigned?: boolean
  assignmentId?: string | null
  deviceId?: string | null
  deviceUid?: string | null
  serialNumber?: string | null
  imei?: string | null
  health?: {
    status?: string | null
    reason?: string | null
    lastSeenAt?: string | null
    lastLocationAt?: string | null
    stale?: boolean
    [key: string]: unknown
  } | null
  latestLocation?: MyFleetLocationContext | null
  locations?: unknown[]
  [key: string]: unknown
}
```

---

## Page → Endpoint Usage Map

Useful for tracing backend changes back to UI impact.

| Page                                  | Endpoints called                                                                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/my-fleet.tsx`              | `GET /myfleet?status=ACTIVE`                                                                                                                                                                                                    |
| `src/pages/vehicle-detail.tsx`        | `GET /myfleet?status=ACTIVE`, `GET /trips?vehicleId={id}`                                                                                                                                                                       |
| `src/pages/vehicle-new.tsx`           | `GET /vehicles/by-plate/{plate}`, `POST /myfleet`                                                                                                                                                                               |
| `src/pages/pay-charges.tsx`           | `GET /vehicles/by-plate/{plate}`, `GET /municipal-routes?...&allowedUse=SPECIAL_PERMIT`, `POST /trips`, `POST /special-permit-route-requests`                                                                                   |
| `src/pages/permits.tsx`               | `GET /municipal-routes?...&allowedUse=ROAD_CLOSURE`, `GET /municipal-routes/{routeId}`, `GET /road-closure-permits?...`, `POST /road-closure-permits`                                                                           |
| `src/pages/public-trip-landing.tsx`   | `GET /public/prepaid-trips/vehicles/by-plate/{plate}` *(no auth)*, `GET /municipal-routes?...` *(no auth)*, `POST /public/prepaid-trips` *(no auth)*                                                                            |

---

## Appendix: HTTP Status Behavior

`apiRequest()` treats `204 No Content` as `null` and otherwise parses the response body as JSON when `Content-Type: application/json`, or as text otherwise (`src/lib/api.ts:176`). Non-2xx statuses throw `ApiError` carrying the parsed body — callers should surface the message via `getApiErrorMessage()`.
