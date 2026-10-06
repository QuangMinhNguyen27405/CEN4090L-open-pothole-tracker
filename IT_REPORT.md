# Software Implementation and Testing Report

**Project:** Open Pothole Tracker

**Repository inspected:** 2026-10-05, including the latest pull through `85548cb`. Recorded browser results predate the newly merged pothole API.

**Project team:** Linh Nguyen, Thien Le, Vinh Do, Hoang Vu, Quang Minh Nguyen

> This report distinguishes source implementation, command results, member-reported browser checks, and tests still to run. Increment 1 requires Sections 1 and 2; the later sections retain the team's testing plan and record available evidence without implying that all requirements have passed.

## 1. Programming languages

| Language | Where it is used | Reason supported by the setup |
| --- | --- | --- |
| TypeScript | Backend API, models, middleware, and frontend React components (`.ts`/`.tsx`). | One typed language across server and client; the backend enables strict type checking in `backend/tsconfig.json`. |
| SQL | `backend/db/schema.sql` and parameterized queries in backend models. | Defines relational constraints and geospatial storage/queries through PostGIS. |

The frontend uses HTML in `frontend/index.html`, TSX markup in React components, and CSS/Tailwind utilities in `frontend/src/index.css` and component classes. JavaScript is the browser output of the TypeScript/Vite build and is also used for `frontend/eslint.config.js`. The backend detection code is TypeScript and calls Roboflow; a separate Python model implementation is not included.

## 2. Platforms, APIs, databases, and other technologies

| Technology | Current use or status |
| --- | --- |
| Node.js and Express 5 | Backend HTTP API; `backend/package.json` requires Node >=24 and exposes development/start scripts. |
| PostgreSQL 17 + PostGIS 3.5 | Configured in `backend/docker-compose.yml`; tables for users, geolocated potholes, and confirmations in `backend/db/schema.sql`. |
| Docker Compose | Starts the database and mounts initial schema; no application container is defined. |
| Firebase Authentication / Admin SDK | Google popup sign-in and backend ID-token verification. Frontend initialization is deferred until Google sign-in is requested, so missing Firebase settings do not prevent public pages from loading. |
| JWT, bcrypt, Zod | Session token in HttpOnly cookie, password hashing, and request validation in the backend. |
| React 19 and React Router | Application entry point, public home/map routes, and existing account/profile pages under shared navigation and layout. |
| Vite 7 and TypeScript 5.8 | Frontend development server, import aliases, strict type checking, production build, and local API proxy. Dependencies are recorded in `frontend/package.json` and its lockfile. |
| Tailwind CSS 4, Radix UI, Headless UI, Heroicons, Lucide | Shared components, responsive styles, icons, and light/dark themes. |
| Axios, TanStack Query, Zod | API requests and account mutation/query state; the pothole client validates the response and normalizes numeric/string IDs. |
| Google Maps JavaScript API and `@vis.gl/react-google-maps` | Interactive map, advanced markers, and location arrow; requires a Maps API key and map ID. |
| Browser Geolocation and Device Orientation APIs | Location and heading for map display, with a fallback location. Camera/GPS capture for detection remains future work. |
| Sharp and Roboflow | Image preprocessing and external inference through the backend image-analysis endpoint. |
| Camera capture and real-time transport | Deferred integration work; the current frontend map does not subscribe to live updates. |

The database uses PostgreSQL/PostGIS. The backend now includes health/account routes, image analysis, detection persistence and image upload, pothole list/detail/along-route reads, confirmations, and nearby lookup. The new list handler requires west/south/east/north bounds and returns a bare array of `id`, `lat`, `lng`, `confidence`, `detection_count`, `verified`, `created_at`, and `last_detected_at`. Its detail route also returns `image_urls`. The frontend still sends only `limit=100` and expects a `{ data: [...] }` envelope with camelCase fields and images. Adapting the request, field names, response envelope, and image loading is necessary before data-backed map verification. Source inspection predicts HTTP 400 for the current request after this pull; that new outcome has not been tested.

### 2.1 Increment 1 frontend implementation

Thien Le's frontend work is recorded in [PR #5](https://github.com/QuangMinhNguyen27405/CEN4090L-open-pothole-tracker/pull/5), commit [`7703114`](https://github.com/QuangMinhNguyen27405/CEN4090L-open-pothole-tracker/commit/7703114). It primarily supports FR-02 and FR-03 and connects the existing FR-01 account pages to the application.

- **Application foundation:** `main.tsx` mounts React; `App.tsx` combines routing, theme, authentication, and query providers. Shared navigation connects `/`, `/map`, `/login`, `/signup`, and `/profile`.
- **Public resources:** `homePage.tsx` displays agency and insurer resource cards with links that open in another tab. Viewing the page does not require an account.
- **Map and details:** `mapPage.tsx` uses browser location, a fallback center, zoom 17, and a location arrow. `potholeMarker.tsx` contains animated markers, confidence/verification badges, detection details, coordinates, and thumbnails; `imageViewer.tsx` provides enlarged photo viewing.
- **Data handling:** `potholeService.ts` requests up to 100 records, sets a 15-second timeout, supports cancellation, validates the response using Zod, and normalizes IDs. The page deduplicates records by ID, announces loading/empty status, and offers Retry after failures.
- **Account integration:** Existing account/profile pages are included in the shell. Integration fixes defer Firebase initialization, use the configured API origin for session loading, prevent recursive logout requests, and narrow profile errors with an Axios type guard. These changes do not replace the team's account backend.
- **Presentation:** Maintain the agreed navigation, themes, animated markers, anchored popups, thumbnails, and image viewer. Source comparisons were performed; exact rendered appearance and complete accessibility/device behavior still need verification.

### 2.2 Frontend configuration and execution

Use Node 24 or later to match the backend requirement. From `frontend/`, run `npm ci`, create a local `.env` from `.env.example` only if it does not already exist, and set `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_ID`. Firebase settings are needed only for Google sign-in. Backend service-account credentials must not be placed in frontend `VITE_` variables.

Leave `VITE_API_URL` blank for local development: Vite forwards `/api` to `http://localhost:8000`. A direct API origin instead needs compatible backend CORS and cookie configuration. The Vite proxy is development-only; deployment needs equivalent routing or a configured API origin. Restart the dev server after changing environment settings.

```powershell
# From frontend/ (npm.cmd is also usable in PowerShell)
npm ci
npm run build
npm run lint
npm run dev
```

Run the backend and database separately. The backend reads `backend/.env`, not a repository-root `.env`. With Docker Desktop running, execute `docker compose up -d` from `backend/`, then start the API with `npm run dev`. `/api/health` queries the database and should return `{ "status": "ok" }`. This confirms connectivity, not the existence or correctness of the pothole list route.

## 3. Execution-based functional testing

**Recorded evidence on 2026-10-05:** During frontend implementation, the production build and TypeScript checks passed using Node 24.12.0; lint completed with zero errors and two existing hook-dependency warnings in `loginPage.tsx`. In the subsequent guided local check, Thien's terminal reported Node 24.21.0 and npm 11.19.0. He reported the page/map checks working, reported a successful backend health response, and supplied browser-console evidence of HTTP 401 for the logged-out session check and HTTP 404 for the missing pothole list. Those screenshots were taken before the latest API pull. They remain historical partial integration results, not a completed real-data map test. The new endpoint and its changed contract still require a fresh test.

| Check | Expected result | Actual result and evidence | Status |
| --- | --- | --- | --- |
| Frontend build and TypeScript | Compilation and bundling succeed. | Passed during PR #5 implementation; bundle-size and third-party annotation warnings remain. | Passed static/build checks. |
| Frontend lint | No lint errors. | Exit code 0; zero errors and two login hook-dependency warnings. | Passed with warnings. |
| Public page/map display | Home/navigation/themes and configured map display work. | Thien reported the requested frontend checks working; individual device/browser versions and measurements were not recorded. | Member-reported basic smoke check; formal device coverage pending. |
| `GET /api/health` | API reaches its database and returns `{ "status": "ok" }`. | Thien reported the expected response after starting the database and API. | Connectivity check passed. |
| Frontend `GET /api/auth/me`, logged out | HTTP 401 for no authenticated session. | HTTP 401 shown in supplied browser console after the proxy/server were configured. | Expected logged-out response; sign-in/profile actions not tested. |
| Frontend `GET /api/potholes?limit=100` | A populated or empty `{ data: [...] }` response for a completed implementation. | HTTP 404 shown before the latest API pull. A handler now exists with required bounds and a different response contract; no post-pull result is recorded. | Known integration blocker. |
| Real pothole markers, details, and images | UI matches a known populated backend response. | No successful list response available. | Blocked/not verified. |
| Nearby lookup | Valid/invalid query behavior and live spatial results are correct. | Existing team progress log records four passed mocked HTTP/query-argument tests and a passed typecheck for PR #6. Not rerun for this report update. | Mocked evidence recorded; live spatial-data check pending. |

The previously observed connection-refused and Vite proxy 500 errors occurred while the backend/database were not listening locally. After local PATH configuration, startup, and frontend proxy configuration, requests reached the API and returned the 401/404 results above. `backend/test/nearby-potholes.test.ts` now exists. Backend dependency installation succeeded but reported two moderate audit findings and package/script warnings; their impact has not been assessed in this test.

The following test matrix follows the functional requirements and lead/supporting modules in `RD_REPORT.md`. “Code present” is an inspection result, not a passed test.

| RD ID | Test scenario and expected result | Present evidence / result |
| --- | --- | --- |
| FR-01 | Create an account, sign in/out, and update a profile. | Logged-out session check returned 401; account actions are **not verified**. |
| FR-02 | Open the map, explore an area, and view a pothole's details. | Map display reported working; real-data markers/details are **blocked by the frontend/backend contract mismatch**. |
| FR-03 | Open public claim resources. | Public page reported working; individual external destinations are **not verified**. |
| FR-04 | Capture camera input with location permission. | Map-only location code exists; camera/frame submission is **not implemented**. |
| FR-05 | Submit camera data and receive a detection result. | Image-analysis route and adapter exist; **live model response not verified in this report**. |
| FR-06 | Create and retrieve a geolocated report with detection details. | Detection-write/image-upload and list/detail/nearby routes now exist; the full browser flow is **not verified end-to-end**. |
| FR-07 | Find nearby reports and handle a repeated detection. | Mocked nearby tests recorded by the team; a 10-meter detection matching implementation now exists. Live spatial and duplicate behavior remain **unverified**. |
| FR-08 | Receive a detection notice and see a new map marker. | Read-only map exists; real-time transport/notifications are absent, so **not testable yet**. |
| FR-09 | Confirm a report and view community feedback. | Confirmation model and authenticated upsert route exist; community UI is absent and the flow is **not verified end-to-end**. |
| FR-10 | Admin reviews, verifies/rejects, and manages a report. | Review workflow absent; **not testable yet**. |
| FR-11 | Unauthorized and non-admin users are denied protected actions. | Logged-out session lookup returned 401; ownership/admin/write restrictions are **not verified**. |

For implementation, seed a temporary PostGIS database, run API integration tests against each route, then add browser tests with camera/location mocks and a controlled detection-service stub. Record dates, environment, inputs, expected/actual results, and defects for each run.

## 4. Execution-based non-functional testing

The basic connectivity and logged-out session checks above do not establish performance, privacy, security, accessibility, or full device compatibility. No measured latency/load or formal accessibility/device results are recorded. The following runs should verify `RD_REPORT.md` NFRs when the corresponding features exist:

| RD ID | Execution method | Evidence to record |
| --- | --- | --- |
| NFR-01 | Exercise protected routes without a token, with a different user's token, and with non-admin role; inspect production cookie flags and HTTPS. | Response codes, cookie headers, deployment configuration. |
| NFR-02 | Deny camera/location permission and inspect network requests and stored media. | Browser behavior and data-retention trace. |
| NFR-03 | Send boundary and out-of-range coordinates/confidence plus repeated confirmations. | API responses and database state. |
| NFR-04–05 | Load a representative report dataset; time map-area API responses and report-to-map updates. | Dataset size, hardware, network, p95 latency, update delay. |
| NFR-06 | Make the detector unavailable during submission. | User-visible error, API health, absence of a false report. |
| NFR-07–08 | Keyboard/screen-reader walkthrough and mobile browser/device matrix. | Browser/device versions, task outcomes, accessibility defects. |

These are **planned tests**, not completed measurements. The proposed targets in `RD_REPORT.md` need team agreement before pass/fail decisions.

## 5. Non-execution-based testing and inspection

This report includes a source walkthrough of the route registrations, controllers, models, schema, Compose file, package metadata, and frontend imports. It is not evidence of a formal peer review. The inspection found:

1. **Remaining feature gaps:** The latest pull adds detection persistence, image upload, list/detail/along-route reads, and confirmations. Camera capture, complete frontend integration, live updates, and administrative review remain unfinished; the new routes have not been runtime-verified for this report.
2. **Frontend setup completed:** The manifest, entry point, routes, shared UI/utilities, and build setup were added in PR #5. The remaining read-integration mismatch is the frontend list request with only a limit and an expected `{ data: [...] }` envelope versus the backend bounds-based list with a bare array and different field names. Photo loading also requires integration with the detail response.
3. **Security review item:** `requireAdmin` is defined but no review route uses it. Future admin endpoints must apply it. The JWT cookie becomes `secure` only when `NODE_ENV=production`; production configuration must set that value and HTTPS.
4. **Data validation review item:** The database constrains confidence and unique confirmations; nearby lookup validates coordinates/radius/limit; detection accepts bounded JPEG/PNG bodies. Frontend response validation is present. New detection-write and confirmation routes have validation schemas, but their boundary/error cases and authorization behavior still need integration tests.
5. **UI/API contract mismatch:** Auth page error rendering reads `error.response?.data?.errors[0].message`, while backend validation responds with `{ error: issues }` and several auth failures respond with `{ message }`. Some failures may display a fallback message or throw while rendering; align the error contract and test it.
6. **Profile placeholders:** `backend/src/controllers/user.controller.ts` returns `detectionSessions: 0`; the profile page's change-password, notification, privacy, and avatar buttons have no action handlers. Present these as unfinished controls until wired.
7. **Schema lifecycle:** Compose mounts `schema.sql` as an initialization script. Existing database volumes will need migrations or a deliberate reset for later schema changes.

**Next verification gate:** agree on and implement the frontend pothole-read contract, prepare known PostGIS records near the displayed map location, and verify populated, empty, malformed, and failed API responses. Check markers/details/images against those records, retry after recovery, and review public links, keyboard/focus behavior, mobile layouts, and exact visual consistency. Continue the detection-to-report-to-map-to-confirmation integration and record actual outcomes rather than marking the whole workflow complete after startup.

### 5.1 Frontend checks still to run

- Compare returned pothole IDs, coordinates, dates, confidence, verification state, counts, and photos with the rendered markers/details.
- Confirm that an empty data array gives no pothole markers and announces empty status; malformed payloads and failed requests must remain distinguishable from that result.
- Restore a failed backend request and exercise Retry.
- Exercise location permission allowed/denied/unavailable cases and missing/invalid Maps configuration.
- Verify navigation and popups at 390px and 1440px widths and on a real mobile browser; record browser/device versions.
- Verify Tab and Enter/Space marker activation, popup/image-viewer dismissal, focus return, and screen-reader status. Full popup keyboard/focus handling remains a follow-up.
- Check each external claim-resource destination.
- Compare the agreed UI using matched theme, map configuration, location, data, and viewport.
