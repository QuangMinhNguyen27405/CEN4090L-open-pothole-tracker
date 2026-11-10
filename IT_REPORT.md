# Software Implementation and Testing Report

**Project:** Open Pothole Tracker

**Version:** 2.2

**Authors:** Linh Nguyen, Thien Le, Vinh Do, Hoang Vu, Quang Minh Nguyen

**Scope:** Current system implementation and verification status.

> This report distinguishes source implementation, executed test results, member-reported browser checks, and planned verification. Planned tests are not presented as passed tests.

## 1. Programming languages

| Language | Where it is used | Reason supported by the setup |
| --- | --- | --- |
| TypeScript | Backend API, models, middleware, and frontend React components (`.ts`/`.tsx`). | One typed language across server and client; the backend enables strict type checking in `backend/tsconfig.json`. |
| SQL | `backend/db/schema.sql` and parameterized queries in backend models. | Defines relational constraints and geospatial storage/queries through PostGIS. |
| Python | `training/` scripts that download and prepare datasets and train, evaluate, run, and upload the detection model. | Ultralytics YOLO, PyTorch, and the Roboflow SDK are Python libraries. |

The frontend uses HTML in `frontend/index.html` for the page shell and CSS/Tailwind utilities in `frontend/src/index.css` and component classes for presentation. JavaScript is used by the browser at runtime, generated from the TypeScript/Vite build, and used in `frontend/eslint.config.js`; these are standard parts of the web platform and lint tooling. The backend detection code is TypeScript and calls the hosted Roboflow model. The Python scripts in `training/` build and evaluate that model offline; they are not part of the running application.

## 2. Platforms, APIs, databases, and other technologies

| Technology | Where it is used |
| --- | --- |
| Node.js 24 and Express 5 | Run the backend HTTP API, including health, account, detection, pothole, confirmation, and event-stream routes. |
| PostgreSQL 17 and PostGIS 3.5 | Store user accounts, pothole reports, detection records, and confirmations; PostGIS supports location-based queries. |
| Docker Compose | Run the PostgreSQL/PostGIS database and initialize a new database from `backend/db/schema.sql`. |
| Firebase Authentication and Firebase Admin SDK | Support Google sign-in in the frontend and verify Firebase ID tokens in the backend. |
| JWT, bcrypt, and Zod | Authenticate API sessions using an HttpOnly cookie, hash account passwords, and validate API input. |
| React 19 and React Router | Build the frontend application, including public home/map pages and account/profile routes. |
| Vite 7 and TypeScript 5.8 | Develop and build the frontend, run type checking, and proxy local API requests. |
| Tailwind CSS 4, Radix UI, Headless UI, Heroicons, and Lucide | Provide shared interface components, responsive styling, icons, and light/dark themes. |
| Axios, TanStack Query, and Zod | Make API requests, manage frontend query/mutation state, and validate/normalize pothole responses. |
| Google Maps JavaScript API and `@vis.gl/react-google-maps` | Display the interactive map, pothole markers, and user-location indicator; requires a Maps API key and map ID. |
| Browser Geolocation, Device Orientation, and MediaDevices APIs | Obtain the user's location and heading, and capture camera images with associated GPS coordinates. |
| Sharp and Roboflow | Preprocess submitted images and perform pothole inference through the backend detection integration. |
| Ultralytics YOLO11 and PyTorch | Fine-tune the pothole detection model in `training/` and run it locally for evaluation and prediction. |
| Roboflow Python SDK | Download the training datasets and upload trained weights to the hosted model that the backend calls. |
| Pillow, PyYAML, Requests, and python-dotenv | Copy the backend's image preprocessing, read dataset and settings files, and call the hosted model during evaluation. |
| Server-Sent Events (SSE) | Send pothole-update notifications from the backend to open map clients, which then reload reports. |

For local development, the Vite proxy forwards `/api` requests to `http://localhost:8000`; deployments must provide equivalent routing or configure an API origin. Google Maps, Firebase, Roboflow, and database access require their corresponding configuration and credentials.

The report workflow combines camera/GPS capture, API validation, image analysis, PostGIS persistence, and event delivery. After a stored report changes, the event stream tells open maps to reload; the interface announces an update only after the reload succeeds. Disconnected streams expose a manual refresh option and trigger a new snapshot after reconnection. Discarded or replaced captures ignore late responses, and closing capture releases camera resources. Confirmations use authenticated API requests and update the existing user/report response.

The shared interface uses keyboard-operable markers, dialogs with focus restoration, viewport-constrained details, photo fallbacks, and stacked status panels on narrow screens. Details and photos render outside the map's stacking context so notifications cannot cover their controls. Custom marker content explicitly accepts pointer events, while report markers appear above the location indicator. Public resources use descriptive external links with the existing card styling.

The Directions drawer accepts an origin and destination, including the current location as an origin. Google services provide address suggestions, coordinates, and route alternatives. Selecting a route changes its highlighting; Start Driving becomes available after a route loads. Driving follows device location at zoom 17 with a tilted map. Stop Driving ends warning polling and restores normal tilt. Editing an address clears stale routes and stops driving; failed route requests offer retry. The existing camera capture and analysis workflow remains separate from route planning.

Driving warnings query `GET /api/potholes/nearby` with `latitude`, `longitude`, `radiusMeters=200`, and `limit=100`, rather than relying on the latest 100 records displayed on the map. Queries run sequentially, with the next scheduled three seconds after completion. The client filters candidates by current distance and available GPS travel heading or compass heading. It displays the closest qualifying warning for up to six seconds, with a nine-second interval between repeats for the same report. Missing location and API failures produce status messages; a fallback map center does not count as a device position. These settings have not been validated as real-world warning-performance guarantees.

Pothole details read public aggregate counts and the signed-in viewer's previous response. The interface provides loading/retry states, cancels pending reads before voting, and preserves one response per account/report. Detection writes require sign-in; image attachment enforces owner/admin access.

## 3. Execution-based functional testing

**Current verification status:** Recorded results below apply to their documented revisions and environments, not automatically to the current integrated implementation. Navigation, warning behavior, live-refresh recovery, and the combined details interface require verification. The last navigation browser run encountered address-label lookup failures; the source correction has not been rerun. Existing camera/detection fixtures require alignment with the current authenticated submission and explicit Start camera workflow. No new tests were run when preparing this revision, apart from the model training checks in section 3.3.

**Recorded evidence on 2026-11-09:** Using Node 24.18.0 and npm 11.16.0, the backend test suite passed all 8 tests: detection/report persistence with a mocked detector/database, nearby-query validation and parameter handling, and event-stream delivery. The frontend TypeScript check and production build also passed. The build reported third-party annotation and large-chunk warnings. These results verify the covered automated checks; they do not establish full browser, live-service, or live-database behavior.

The browser checks recorded on 2026-10-05 are historical: a team member reported the public page/map and database health check working, and supplied a logged-out HTTP 401 plus a pothole-list HTTP 404 from before the list route was added. Those results are not evidence of current end-to-end behavior.

| Check | Expected result | Actual result and evidence | Status |
| --- | --- | --- | --- |
| Backend automated tests | Covered API/model cases pass. | `npm test` passed 8/8 tests: 3 detection/report tests, 4 nearby-pothole tests, and 1 event-stream test. Detector and database behavior are mocked in these tests. | Passed for covered cases; not a live PostGIS or Roboflow integration test. |
| Frontend build and TypeScript | Type checking and production bundling succeed. | The earlier `npm run build` passed with Node 24.18.0. For the recorded capture revision, TypeScript (`tsc -b`) and Vite production build passed with Node 24.22.2. The build emitted third-party annotation and large-chunk warnings. | Passed with warnings; browser behavior not verified. |
| Frontend lint | No lint errors. | For the recorded capture revision, ESLint exited 0 with two existing hook-dependency warnings in `loginPage.tsx`. | Passed with warnings. |
| Public page/map display | Home/navigation/themes and configured map display work. | A team member reported the basic page/map check working on 2026-10-05; browser/device versions were not recorded. | Historical member-reported smoke check; current browser behavior not verified. |
| `GET /api/health` | API reaches its database and returns `{ "status": "ok" }`. | A team member reported the expected response on 2026-10-05. | Historical connectivity check; not rerun. |
| `GET /api/auth/me`, logged out | HTTP 401 for no authenticated session. | HTTP 401 shown in the 2026-10-05 browser-console evidence. | Historical expected response; account flows not verified. |
| `GET /api/potholes?limit=100` and map data | The client receives records matching the map's expected schema. | The 2026-10-05 HTTP 404 predates the current list route. Current source inspection shows the frontend request and backend `{ data: [...] }` response contract align; no current browser request with populated data is recorded. | Source contract appears aligned; data-backed map rendering not verified. |
| Nearby lookup | Valid/invalid query behavior and spatial results are correct. | Four automated tests passed as part of the 2026-11-09 backend suite; query parameters are checked, but database calls are mocked. | Automated validation passed; live PostGIS behavior not verified. |
| Camera/report flow and live map updates | A capture is analyzed, stored when applicable, and reflected on an open map. | Capture/report submission, SSE subscription, and report refresh are present in source. The capture UI includes an explicit camera start, purpose text, permission/error states, and stream cleanup. The event-stream delivery test passes; full browser-to-database flow was not run. | Implemented; end-to-end behavior not verified. |

Implemented features still require execution-based tests; implementation alone is not counted as evidence that a functional requirement passes.

### 3.1 Camera and GPS capture

**Implementation:** The map capture component explains why camera and location access are requested before starting the camera. It waits for **Start camera** before calling `getUserMedia`, captures one JPEG scaled to at most 1600 pixels on its longest side, rejects files above the API's 5 MB limit or invalid GPS readings, requests a fresh GPS position, and passes the image, coordinates, capture time, and GPS accuracy to the existing map preview and `POST /api/detections/report` submission flow. It distinguishes camera denial/unavailability and location denial/unavailability/timeout, offers camera retry, uses the shared Radix modal for keyboard focus and Escape handling, stops media tracks on close/unmount, and ignores late camera/GPS results after the dialog closes. The frontend source was checked with TypeScript, ESLint, and a production build using Node 24.22.2; all three completed, with the warnings recorded above. These checks do not exercise browser permissions or the backend; backend tests were not rerun for this frontend change.

| Remaining test | Expected evidence |
| --- | --- |
| Browser permissions and lifecycle | On a real mobile browser and a desktop browser, verify allowed, denied, unavailable, and timeout cases; camera retry; Escape/close while camera or GPS is pending; and that the camera indicator turns off on close. Record browser/device versions and screenshots or observations. |
| Capture-to-API flow | With a controlled detector and test database, capture a road image, inspect JPEG dimensions and size plus request `lat`, `lng`, `capturedAt`, and `gpsAccuracy`, then verify detected/no-detection/error responses, saved image/report state, and map refresh. Confirm **Discard** sends no request. |
| Geospatial queries and duplicate matching | With known PostGIS points, verify nearby boundary inclusion, meter distances, nearest-first ordering, empty results, and the 10-meter duplicate match against actual rows; inspect the spatial index plan with representative data. The four existing nearby tests use mocks. |
| Accessibility and compatibility | Check focus return and keyboard operation of the modal/preview, screen-reader announcements, mobile layout, and browser support for camera and geolocation. |

**Concerns to resolve:** The GPS reading is requested after the image is captured, so movement or an inaccurate reading may place a report at the wrong point; no maximum GPS-accuracy threshold is defined. Detection write routes require a signed-in user (section 3.2). Camera/geolocation APIs and the map depend on browser permissions and deployment configuration, so a successful build is not evidence of device support or a complete end-to-end flow.

### 3.2 Authentication, access control, confirmations, and administration

**Test environment:** Node 25.9.0, a disposable `postgis/postgis:17-3.5` container, the local API, the Vite development server, and headless Google Chrome 153. The project specifies Node 24 or later; these checks were not repeated on Node 24.

| Check | Expected result | Actual result and evidence | Status |
| --- | --- | --- | --- |
| Backend automated tests and type check | All pass. | `npm test` passed 80/80 and `npm run typecheck` passed. Database and detector calls are mocked in these tests. | Passed for covered cases. |
| Frontend tests, build, and lint | All pass. | `npm test` passed 6/6. `npm run build` passed with existing large-chunk warnings. `npm run lint` reported no errors and two existing hook warnings in `loginPage.tsx`. | Passed with warnings. |
| Regression check on the access tests | Weakening access checks makes tests fail. | Temporarily allowing every caller in `canManage` caused 2 failures, and in `requireAdmin` caused 3. Both changes were reverted. | Passed. |
| Schema migrations | Applying and reverting leaves the schema unchanged. | For `001_pothole_review` and `002_detection_user`, `pg_dump -s` before applying matched the result after reverting, and the migrated schema matched a fresh `schema.sql`. | Passed on PostGIS. |
| Login and signup errors | Failures show the API message without a page error. | In the browser, a wrong password, an invalid email, and a duplicate email each showed the expected message, with no page exceptions. | Passed. |
| Admin access | Anonymous 401, non-admin 403, admin allowed. | Confirmed by automated tests and live requests. In the browser, anonymous visitors were redirected to `/login`, regular users to `/`, and only the admin saw the Admin link. | Passed. |
| Admin review workflow | An admin can review evidence and record decisions. | Queue, filters, details, photo thumbnail, reject, verify, and the empty state worked in the browser. The reviewer and review time were saved in PostGIS. An invalid decision returned 400 and an unknown report 404. | Passed. |
| Rejected-report visibility | Rejected reports leave public reads; a new nearby detection reopens them. | After rejection a report was absent from the list, nearby, and along-route reads, and its detail returned 404. A detection about 1 m away returned it as pending with the review cleared. An unrelated report was unaffected. | Passed on PostGIS. |
| Detection write protection | Anonymous writes rejected; only the owner or an admin can attach images. | Live requests: anonymous writes 401, owner and admin image upload 200, a regular user on an ownerless detection 403, and an unknown detection 404. | Passed. |
| Reporter attribution and profile statistics | The signed-in user is stored and profile counts match rows. | The user id was saved on the detection and pothole rows, and the profile page showed counts matching the database. | Passed on PostGIS. |
| Map access for signed-out visitors | The map stays public and capture asks for sign-in. | With a placeholder map key, signed-out visitors stayed on `/map` and saw the sign-in link. Signed-in users saw the capture control instead. | Passed; live Google Maps not rendered. |
| Community confirmations | Counts appear before voting; an earlier answer is shown and can change. | With the real marker component and a stubbed Google Maps library, anonymous counts, the highlighted answer, changing it, and persistence after reload all worked. Rejected and unknown reports returned 404. | Passed; live Google Maps not rendered. |
| Decision reaches open maps | A review publishes a pothole update. | A live event-stream client received `potholes.updated` after a decision. | Event delivery passed; the visible map refresh was not observed. |

**Not verified:** Google sign-in, the `Secure` cookie flag and HTTPS in a deployed environment, rendering on the live Google Maps service, a real camera capture through Roboflow, and behavior on physical mobile devices. Automated tests in this section mock the database; PostGIS integration tests are not part of this suite.

For the remaining API and database scenarios, we plan to run the backend with a test PostGIS database, send requests with valid and invalid inputs, and verify both response status/body and resulting database state. For browser flows, we plan to use test accounts and mock browser permissions such as camera and location. We will record the test date, setup, steps, expected result, actual result, and any defects.

| RD ID | Planned test procedure and expected result | Current status |
| --- | --- | --- |
| FR-01 | Register a test account, log in with correct and incorrect credentials, log out, and update its profile; verify success and validation/error responses. | Signup, login, logout, session, profile, and password behavior pass automated tests with a mocked database. Login and signup success and failure were exercised live (section 3.2). Google sign-in is **not verified**. |
| FR-02 | Open the map, pan/zoom to a test area, select a report marker, and verify its details match the API response. | Basic map display was reported working historically. The source-level list contract appears aligned; populated-data markers/details are **not verified in a current browser test**. |
| FR-03 | Open each public claim resource and verify its destination and content. | Public page display was reported working historically; individual external destinations are **not verified**. |
| FR-04 | Grant camera and location permissions, capture an image, and verify the image and coordinates are available for submission. Repeat with permissions denied and verify a clear error. | Camera/GPS capture and submission are implemented in the frontend; the full browser permission/capture flow is **not verified**. |
| FR-05 | Submit a supported image to the detection endpoint and verify the returned prediction format; also test invalid media, oversized input, and detector failure. | Automated tests cover qualifying/no qualifying mock predictions and invalid coordinates. A live Roboflow response and all media/failure boundaries are **not verified**. The model training and evaluation scripts are checked in section 3.3; no trained model has been evaluated. |
| FR-06 | Submit a report with valid coordinates and detection details, then retrieve it and compare the response to the saved database row. Repeat with invalid coordinates. | Detection persistence and list/detail routes exist; automated detection tests use mocked database calls. Live database retrieval and full browser flow are **not verified**. |
| FR-07 | Create reports at nearby and distant coordinates, query the area, and verify nearby duplicates are matched while distant reports remain separate. | Nearby query validation and SQL parameter handling pass mocked automated tests. Live PostGIS spatial and duplicate behavior remain **unverified**. |
| FR-08 | Submit a report while the map is open and verify the expected notification and marker update appear. | Backend event delivery test passes and the map subscribes/refreshes in source; the full report-to-open-map flow is **not verified end-to-end**. |
| FR-09 | Confirm a report as a user, submit a repeat confirmation, and verify the saved confirmation and community feedback. | Viewing counts, viewing and changing the user's own answer, and persistence after reload were verified with a stubbed map library (section 3.2). Rendering on live Google Maps is **not verified**. |
| FR-10 | Sign in as an admin, review a report, approve/reject it, and verify the saved status; repeat as a non-admin and expect denial. | Admin and non-admin behavior, saved decisions, and the dashboard workflow passed automated, live API, and browser checks (section 3.2). |
| FR-12 | Search/select addresses, switch routes, start/stop driving, and verify map following and nearby warnings, including missing GPS and service failures. | Implemented; verification of the current integrated workflow remains pending. |
| FR-11 | Call protected operations without a token, with an invalid token, and with a valid token for a user lacking permission; verify unauthorized requests are rejected. | Missing, invalid, expired, and wrongly signed tokens, deactivated users, role checks, and ownership checks pass automated tests. Admin and detection write protection were also confirmed with live requests (section 3.2). |

Next, run API integration tests against a temporary PostGIS database, then exercise browser flows with camera/location permissions and a controlled detection-service stub. Record dates, environment, inputs, expected/actual results, and defects for each run.

### 3.3 Detection model training and evaluation

**Implementation:** The Python scripts in `training/` build the detection model offline. They download Roboflow datasets, merge them into one dataset with duplicate images removed across splits and polygon labels converted to boxes, fine-tune YOLO11n, evaluate a local or hosted model with the backend's preprocessing and 0.6 threshold at box and picture level, run a model on selected pictures, and upload trained weights to Roboflow. All settings are read from `training/.env`.

**Test environment:** Python 3.12.7 with Ultralytics 8.4.208, PyTorch 2.15.0 (CPU build), and Roboflow 1.7.3 on Windows 11, without a GPU.

| Check | Expected result | Actual result and evidence | Status |
| --- | --- | --- | --- |
| Static checks | No problems reported. | pyflakes and pycodestyle (120-character lines) reported no problems for every script. | Passed. |
| Dataset download | Downloaded datasets are skipped; invalid settings stop with a message. | Both downloaded datasets were skipped. Missing settings, a non-numeric version, an unsafe folder name, and command-line arguments each stopped with a message. A fresh download was not run; a workspace request with the current API key returned 404. | Passed for covered cases; download not verified. |
| Dataset preparation | The two datasets merge into one YOLO dataset; invalid settings stop with a message. | `datasets/combined` was built with 7,848 training, 2,635 validation, and 1,327 test images and 29,209 boxes. An existing output folder, an unknown source, and an unsafe output name each stopped with a message. | Passed. |
| Training | A short run finishes and saves weights; invalid settings are rejected before training. | A 1-epoch CPU run on 1% of the training images at image size 320 finished and wrote `best.pt`. Invalid epoch, image size, and device values were reported together, and the script exited with code 2. | Passed; a full training run was not done. |
| Evaluation | AP50, box-level and picture-level tables, and a JSON summary are produced. | With a simulated predictor on 160 validation images, including simulated request failures, the script produced AP50, both tables with 0.6 marked, a failure count, and the JSON summary. A missing model and an invalid split or limit each stopped with a message. | Passed for the metric code; no trained or hosted model evaluated. |
| Prediction | Each picture gets a result and a saved copy. | With the pretrained `yolo11n.pt`, which is not trained on potholes, 3 test pictures each printed a result and were saved to `runs/predict`. A missing model stopped with a message. | Passed; pothole predictions not verified. |
| Upload | The model type is read from the training run; invalid settings stop before uploading. | Runs trained from yolo11n, yolov8s, and yolo26m gave `yolov11n`, `yolov8s`, and `yolo26m`. Missing Roboflow settings, missing weights, and a non-numeric version each stopped before any upload. | Passed for covered cases; upload not verified. |

**Not verified:** A full GPU training run and the accuracy of a trained model, a fresh dataset download, evaluation of the hosted Roboflow model, uploading weights, and the backend calling a trained model. The training code has no automated unit tests.

## 4. Execution-based non-functional testing

The automated tests and historical smoke checks above do not establish performance, privacy, security, accessibility, or full device compatibility. No measured latency/load or formal accessibility/device results are recorded. The following tests remain planned for the `RD_REPORT.md` NFRs; features being implemented does not mean these quality criteria have been verified:

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

This report includes a source walkthrough of the route registrations, controllers, models, schema, Compose file, package metadata, and frontend imports. It is not evidence of a formal peer review. The inspection found:

1. **Remaining feature gaps:** Camera/GPS capture, detection submission, pothole list/detail reads, confirmations, live-update subscription, and the admin review workflow are present in the implementation. Full browser-to-database detection flows and live-service behavior still need testing.
2. **Frontend/backend map contract:** Source inspection shows that the frontend list request (`limit=100`) and backend list response (`{ data: [...] }` with the expected record fields) are aligned. A populated PostGIS-backed browser test is still needed to verify returned data, marker details, and photos.
3. **Security review item:** `requireAdmin` protects every `/api/admin` route. The JWT cookie becomes `secure` only when `NODE_ENV=production`; production configuration must set that value and HTTPS.
4. **Data validation review item:** The database constrains confidence and unique confirmations; nearby lookup validates coordinates/radius/limit; detection accepts bounded JPEG/PNG bodies. Frontend response validation is present. New detection-write and confirmation routes have validation schemas, but their boundary/error cases and authorization behavior still need integration tests.
5. **UI/API error contract:** Auth pages read failure messages through a helper that handles the API's `{ message }` and `{ error }` response shapes (section 3.2).
6. **Profile statistics:** The profile shows pothole and detection counts from stored rows. The profile avatar button has no action handler; it should not be presented as an available avatar-upload feature.
7. **Schema lifecycle:** Compose mounts `schema.sql` as an initialization script. Existing database volumes must apply the scripts in `backend/db/migrations/` in numeric order for the review and detection-owner changes.
8. **Copied detection settings:** The training scripts repeat the backend's 640×480 resize, JPEG quality 75, and 0.6 reporting threshold so that evaluation matches deployed behavior. These values are not shared with the backend, so a change in one place requires the same change in the other.

**Next verification gate:** prepare known PostGIS records near the displayed map location and verify populated, empty, malformed, and failed list responses in the browser. Check markers/details/images against those records, exercise retry, and run the complete camera-to-detection-to-report-to-map flow. Also review public links, keyboard/focus behavior, mobile layouts, and visual consistency; record measured outcomes rather than inferring them from source inspection.

### 5.1 Integrated workflow checks still to run

- Compare returned pothole IDs, coordinates, dates, confidence, verification state, counts, and photos with the rendered markers/details.
- Confirm that an empty data array gives no pothole markers and announces empty status; malformed payloads and failed requests must remain distinguishable from that result.
- Restore a failed backend request and exercise Retry.
- Exercise location permission allowed/denied/unavailable cases and missing/invalid Maps configuration.
- Exercise camera permission, image capture, GPS association, report submission, and the resulting map update in a browser.
- Verify navigation and popups at 390px and 1440px widths and on a real mobile browser; record browser/device versions.
- Verify Tab and Enter/Space marker activation, popup/image-viewer dismissal, focus return, and screen-reader status. Popup keyboard/focus handling is implemented; integrated verification remains pending.
- Check each external claim-resource destination.
- Compare the agreed UI using matched theme, map configuration, location, data, and viewport.
