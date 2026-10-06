# Software Implementation and Testing Report

**Project:** Open Pothole Tracker

**Project team:** Linh Nguyen, Thien Le, Vinh Do, Hoang Vu, Quang Minh Nguyen


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

We will test each functional requirement as its corresponding feature becomes available.

For API and database scenarios, we plan to run the backend with a test PostGIS database, send requests with valid and invalid inputs, and verify both response status/body and resulting database state. For browser flows, we plan to use test accounts and mock browser permissions such as camera and location. We will record the test date, setup, steps, expected result, actual result, and any defects.

| RD ID | Planned test procedure and expected result | Current status |
| --- | --- | --- |
| FR-01 | Register a test account, log in with correct and incorrect credentials, log out, and update its profile; verify success and validation/error responses. | Account routes exist; execution is planned. |
| FR-02 | Open the map, pan/zoom to a test area, select a report marker, and verify its details match the API response. | Map and report endpoints are not implemented in this checkout. |
| FR-03 | Open each public claim resource and verify its destination and content. | Resource page is not implemented in this checkout. |
| FR-04 | Grant camera and location permissions, capture an image, and verify the image and coordinates are available for submission. Repeat with permissions denied and verify a clear error. | Capture/location workflow is not implemented in this checkout. |
| FR-05 | Submit a supported image to the detection endpoint and verify the returned prediction format; also test invalid media, oversized input, and detector failure. | Detection router is empty in this checkout. |
| FR-06 | Submit a report with valid coordinates and detection details, then retrieve it and compare the response to the saved database row. Repeat with invalid coordinates. | Schema and create model exist; report endpoints are not implemented. |
| FR-07 | Create reports at nearby and distant coordinates, query the area, and verify nearby duplicates are matched while distant reports remain separate. | Nearby-query and matching logic are not implemented. |
| FR-08 | Submit a report while the map is open and verify the expected notification and marker update appear. | Update and map UI are not implemented. |
| FR-09 | Confirm a report as a user, submit a repeat confirmation, and verify the saved confirmation and community feedback. | Confirmation model exists; route and UI are not implemented. |
| FR-10 | Sign in as an admin, review a report, approve/reject it, and verify the saved status; repeat as a non-admin and expect denial. | Review workflow is not implemented. |
| FR-11 | Call protected operations without a token, with an invalid token, and with a valid token for a user lacking permission; verify unauthorized requests are rejected. | Authentication middleware exists; these scenarios have not been run. |

## 4. Execution-based non-functional testing

We have no measured latency, load, reliability, accessibility, device, or security-test results yet. Before release, we plan to run the following checks in a test environment, once the related features are implemented. We will record the environment, test inputs, results, and any issues.

| RD ID | Planned test method | Evidence to record |
| --- | --- | --- |
| NFR-01 | Send requests without credentials, with another user's credentials, and as a non-admin; verify access is denied. Check cookie flags and HTTPS configuration in the deployment environment. | Status codes, cookie settings, and deployment configuration. |
| NFR-02 | Deny camera/location permissions and inspect browser behavior, network requests, and whether any media or coordinates are retained. | Browser results and observed data handling. |
| NFR-03 | Submit values at, just inside, and outside coordinate/confidence limits; repeat confirmations and check API responses and database rows. | Inputs, responses, and database state. |
| NFR-04–05 | Use a representative dataset and a load-testing tool to increase API traffic; measure map-area response time and report-to-map update delay. | Dataset size, load profile, hardware, network, response-time percentiles, errors, and update delay. |
| NFR-06 | Make the detection provider unavailable during submission and verify that the client receives a clear failure and no false report is saved. | Error response, user-visible behavior, and database state. |
| NFR-07–08 | Complete key tasks using keyboard-only navigation and a screen reader, then repeat them on supported mobile browsers/devices. | Browser/device versions, task outcomes, and accessibility issues. |

## 5. Non-execution-based testing

We have used pull requests to support peer review and have had informal walkthroughs of changes with teammates. These reviews help us discuss implementation choices and catch issues before merging, but they have not yet followed a formal checklist or been documented consistently.

| Review activity | Current practice or next step | What we will check |
| --- | --- | --- |
| Pull-request peer review | Used for current changes; continue requesting teammate review before merging. | Correctness, validation, authorization, error handling, secrets, and consistency with existing patterns. |
| Informal walkthroughs | Used to discuss some changes; continue these as features are developed. | Implementation intent, API and data-flow understanding, and issues noticed by the team. |
| Structured requirements/design review | Plan a fuller walkthrough as the project and requirements mature. Trace RD requirements through design, API/UI behavior, and test plans. | Missing or unclear requirements, edge cases, data ownership, failure paths, and untestable requirements. |
| UI walkthrough | Plan a focused review of key user flows before release. | Navigation, labels, feedback, keyboard access, and consistency with requirements. |
