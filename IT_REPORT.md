# Software Implementation and Testing Report

**Project:** Open Pothole Tracker

**Repository inspected:** 2026-10-05

**Project team:** Linh Nguyen, Thien Le, Vinh Do, Hoang Vu, Quang Minh Nguyen

> This report records what can be established by source inspection. No test passes, performance numbers, device trials, or code-review approvals are claimed without execution evidence.

## 1. Programming languages

| Language | Where it is used | Reason supported by the setup |
| --- | --- | --- |
| TypeScript | Backend API, models, middleware, and frontend React components (`.ts`/`.tsx`). | One typed language across server and client; the backend enables strict type checking in `backend/tsconfig.json`. |
| SQL | `backend/db/schema.sql` and parameterized queries in backend models. | Defines relational constraints and geospatial storage/queries through PostGIS. |

The frontend TSX embeds HTML-like markup and references CSS utility classes, but no standalone HTML or CSS files are present. JavaScript is the execution language underlying the TypeScript code; there are no checked-in `.js` sources. Python or a separate computer-vision implementation is **not present** in the repository.

## 2. Platforms, APIs, databases, and other technologies

| Technology | Current use or status |
| --- | --- |
| Node.js and Express 5 | Backend HTTP API; `backend/package.json` requires Node >=24 and exposes development/start scripts. |
| PostgreSQL 17 + PostGIS 3.5 | Configured in `backend/docker-compose.yml`; tables for users, geolocated potholes, and confirmations in `backend/db/schema.sql`. |
| Docker Compose | Starts the database and mounts initial schema; no application container is defined. |
| Firebase Authentication / Admin SDK | Frontend Google popup code and backend ID-token verification; requires configuration and credentials. |
| JWT, bcrypt, Zod | Session token in HttpOnly cookie, password hashing, and request validation in the backend. |
| React, Axios, TanStack Query, React Router, Heroicons | Referenced by the selected frontend files. A frontend package manifest and supporting modules are missing, so these references are not a buildable client as checked out. |
| Browser camera, geolocation, mapping, computer vision, real-time transport | Product goals from the RD overview; no implementation or chosen provider is visible. |

The current database design uses PostgreSQL/PostGIS. The backend API mounts `/api/health`, `/api/auth`, and `/api/users` with handlers. `/api/potholes` and `/api/detections` mount empty routers and therefore expose no feature handlers.

## 3. Execution-based functional testing

**Observed test evidence:** `backend/package.json` declares a `test` script, but there is no `backend/test` directory or test file in the checkout. `backend/node_modules` and `frontend/node_modules` are absent. The local Node version observed during inspection is **v23.6.1**, below the backend's declared `>=24` requirement. There is also no frontend manifest, application entry point, or API utility modules imported by the shown pages. Accordingly, this report cannot claim successful automated, API, or end-to-end execution. No database or Firebase-backed scenario was run for this report.

The following test matrix follows the functional requirements and lead/supporting modules in `RD_REPORT.md`. “Code present” is an inspection result, not a passed test.

| RD ID | Test scenario and expected result | Present evidence / result |
| --- | --- | --- |
| FR-01 | Create an account, sign in/out, and update a profile. | Account/profile routes exist; **not executed**. |
| FR-02 | Open the map, explore an area, and view a pothole's details. | Report endpoints and map UI absent; **not testable yet**. |
| FR-03 | Open public claim resources. | Resource page absent; **not testable yet**. |
| FR-04 | Capture camera input with location permission. | Capture/location workflow absent; **not testable yet**. |
| FR-05 | Submit camera data and receive a detection result. | Detection router empty; **not testable yet**. |
| FR-06 | Create and retrieve a geolocated report with detection details. | Schema and create model exist; report endpoints absent; **not testable end-to-end**. |
| FR-07 | Find nearby reports and handle a repeated detection. | Spatial index exists; query and matching logic absent; **not testable yet**. |
| FR-08 | Receive a detection notice and see a new map marker. | Update and map UI absent; **not testable yet**. |
| FR-09 | Confirm a report and view community feedback. | Confirmation model exists; route/UI absent; **not testable end-to-end**. |
| FR-10 | Admin reviews, verifies/rejects, and manages a report. | Review workflow absent; **not testable yet**. |
| FR-11 | Unauthorized and non-admin users are denied protected actions. | Existing auth/ownership middleware can be inspected; **not executed**. |

For implementation, seed a temporary PostGIS database, run API integration tests against each route, then add browser tests with camera/location mocks and a controlled detection-service stub. Record dates, environment, inputs, expected/actual results, and defects for each run.

## 4. Execution-based non-functional testing

No measured latency, load, reliability, accessibility, device, or security-test results are present. The following runs should verify `RD_REPORT.md` NFRs when the corresponding features exist:

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

1. **Feature gap:** `backend/src/routes/pothole.routes.ts` and `backend/src/routes/detection.routes.ts` only create routers. The data models cannot yet be reached through the API. The frontend has no map/detection/review components in this checkout.
2. **Incomplete frontend setup:** There is no `frontend/package.json`, app entry point, route setup, or implementations for imported `@/utils/api`, `@/utils/logger`, and `@/components/ui/*`. The selected pages cannot be built from the files present.
3. **Security review item:** `requireAdmin` is defined but no review route uses it. Future admin endpoints must apply it. The JWT cookie becomes `secure` only when `NODE_ENV=production`; production configuration must set that value and HTTPS.
4. **Data validation review item:** The database constrains confidence to 0..1 and allows only one confirmation per user/report, but no current route validates latitude/longitude or media input. Define validation before enabling submissions.
5. **UI/API contract mismatch:** Auth page error rendering reads `error.response?.data?.errors[0].message`, while backend validation responds with `{ error: issues }` and several auth failures respond with `{ message }`. Some failures may display a fallback message or throw while rendering; align the error contract and test it.
6. **Profile placeholders:** `backend/src/controllers/user.controller.ts` returns `detectionSessions: 0`; the profile page's change-password, notification, privacy, and avatar buttons have no action handlers. Present these as unfinished controls until wired.
7. **Schema lifecycle:** Compose mounts `schema.sql` as an initialization script. Existing database volumes will need migrations or a deliberate reset for later schema changes.

**Next verification gate:** restore a buildable frontend and a compatible Node environment, add focused integration tests for existing account/profile endpoints, then implement and test the core detection → report → map → confirmation flows. Record actual results in this report as work is executed.
