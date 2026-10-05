# Increment 1 frontend migration — Thien Le (cl23m)

## Origin and contribution boundaries

Source: local repository `open-pothole-map-repo`, commit `b2eb60bf4dc6ba4c05445ad184f148eb12c21893`. Target: `CEN4090L-open-pothole-tracker`.

This is reuse of an existing team project. The frontend setup, styles, shared UI components, navigation, theme, and public-resource page originate in that project. Its MIT notice is retained in `frontend/LICENSE`. Report this increment's contribution as migration, adaptation, and validation; do not describe the inherited implementation as newly authored this semester. The supplied syllabus does not establish whether prior-project reuse is permitted; confirm that separately with the course's applicable policy/instructor.

Increment 1 adaptations:

- Restore the missing React/Vite entry points, dependency manifest, TypeScript settings, and shared components required by the existing auth/profile pages.
- Preserve the original map presentation, animated markers, anchored read-only detail popups, image thumbnails, and full-screen image viewer. Restore the original home-page wording. Defer only out-of-scope feature controls, without redesigning their eventual replacements.
- Validate the API response and normalize string or PostgreSQL numeric IDs to strings. Announce loading/empty status nonvisually and show Retry only on failure, leaving the successful map view visually unchanged.
- Use a local `/api` proxy for backend integration. Prevent recursive logout requests after a logout failure.
- Defer Firebase initialization until Google sign-in is selected, so public pages do not require Firebase settings.

The target's authentication/profile pages and user service were retained. Firebase initialization and auth context integration points were adjusted, and the profile page's existing `any` error type was replaced with an Axios type guard to pass lint. Backend source and old-repository source were not changed. No previous Git history, secrets, deployment workflows, or demo scripts were imported.

## Scope and proposed requirements

These IDs are drafts for the team to reconcile with its official RD document.

| ID | Proposed requirement | Status/dependency |
| --- | --- | --- |
| FE-01 | The system shall provide public home and map routes with navigation. | Frontend implemented. |
| FE-02 | The system shall display pothole locations on an interactive map without requiring login. | Frontend implemented; Maps key and read API required. |
| FE-03 | The system shall display location, detection date, confidence, verification state, detection count, and available photos for a selected pothole. | Frontend implemented; populated API response required. |
| FE-04 | The system shall provide public links to claim-related resources. | Inherited links displayed; current destinations require manual review. |
| FE-05 | The interface shall distinguish loading, successful empty results, and failed requests and allow retry. | Frontend implemented. |
| NFR-FE-01 | Public pages and details shall remain usable at desktop and mobile viewport widths without horizontal page scrolling. | Responsive styles present; browser verification required. |
| NFR-FE-02 | Map markers shall be keyboard focusable; details shall support keyboard dismissal and focus management. | Marker keyboard activation retained; original popup behavior restored. Full keyboard dismissal/focus management remains a follow-up. |

Increment 1 use cases: browse public resources; view the pothole map; select a marker and read details; retry a failed pothole request. Main flow: Visitor → MapPage → potholeService → GET /api/potholes → render markers → select marker → original anchored details popup. If the API fails, show an unavailable state and Retry. If it returns an empty array, announce the empty result to assistive technology and leave the map unmarked.

Later increments: live updates and notifications; driving mode/directions; camera detection; community confirmations and administrative verification.

## Visual-fidelity revision

The final frontend must look exactly like the old project. This is recorded in the repository's `AGENTS.md` for subsequent work. The initial centered details dialog, permanent map summary panel, alternate default center/zoom, and default Google map controls were removed. The original home text, layout, marker animations, anchored popup styling, image viewer, location arrow, geolocation loading screen, fallback center, zoom 17, and hidden default controls were restored.

Increment 1 still omits camera/driving/community controls. Reuse their original components in later increments. Existing API parsing, PostgreSQL ID normalization, and configuration fixes do not change the successful presentation. A backend failure can still show an error-only Retry notice. Browser-level visual equality has not been verified; compare the same viewport, theme, map ID/style, location, and data before claiming exact parity.

Revision checks: production build and TypeScript passed; lint passed with the same two existing login warnings; `git diff --check` passed. Thirteen key UI files/assets were compared byte-for-byte with the original, including the home page, layout, navigation, styles, image viewer, and location arrow. The original marker animations, read-only popup content, and image-section markup were also compared. The revised JavaScript bundle is approximately 730 kB before gzip; the build retains its size and third-party annotation warnings.

## Backend handoff

The old application used MongoDB; the target uses PostgreSQL/PostGIS. Do not replace the target backend with old MongoDB controllers. Its current pothole router is empty.

Required public endpoint: `GET /api/potholes?limit=100`. It should cap results and return this shape:

```json
{
  "data": [
    {
      "_id": 1,
      "latitude": 30.4383,
      "longitude": -84.2807,
      "confidenceScore": 0.91,
      "detectedAt": "2026-10-05T12:00:00.000Z",
      "verified": false,
      "detectionCount": 1,
      "images": []
    }
  ]
}
```

This JSON is an example contract, not a real report. The original anchored details popup uses the selected list item; a separate detail endpoint is not required for this increment. Pagination and viewport filtering remain future work; this foundation requests up to 100 records. Authentication/profile integration still needs end-to-end validation with the configured database/backend.

## Suggested GitHub work items

Create actual issues and use their assigned numbers in commits and PRs. The labels below are draft titles, not existing GitHub issues.

| Draft issue title | Requirement | Acceptance criteria |
| --- | --- | --- |
| Migrate frontend app foundation and public resources | FE-01, FE-04 | App builds; routes/navigation work; resources and theme render; reuse attributed. |
| Adapt read-only pothole map and details | FE-02, FE-03, NFR-FE-01, NFR-FE-02 | Valid API response produces selectable markers and readable details on desktop/mobile. |
| Add map loading, error, and retry states | FE-05 | Failure does not appear as no reports; retry reloads; empty array leaves the map unmarked and announces empty status. |
| Implement public PostgreSQL pothole list endpoint | FE-02, FE-03 | Backend returns the documented contract with a bounded limit. Assign with backend owner. |
| Validate frontend/backend integration and public links | All above | Complete the manual checks below and record results/remaining defects. |

Use `Refs #<actual-number>` in relevant commits and `Closes #<actual-number>` in the resolving PR. Do not close integration-dependent issues until their acceptance criteria pass. Preserve individual contribution evidence and document unresolved items as known issues.

## Validation checklist

Initial migration checks on 2026-10-05 (before the visual-fidelity revision): dependency installation completed and `package-lock.json` was generated; `npm run build` passed; TypeScript checking passed; `npm run lint` passed with zero errors and two pre-existing hook-dependency warnings in `loginPage.tsx`; `git diff --check` passed. The production build reports an approximately 744 kB JavaScript bundle before gzip and third-party Zod annotation warnings. These are follow-up cleanup items, not build failures. Browser/device testing, live Google Maps, and real backend data were not verified. The backend list endpoint is still absent. The old repository remains unchanged.

- Run the production build and lint commands from `frontend/`.
- Open `/` without Firebase settings; verify home, menu, theme, and claim links.
- Open `/map` without a Maps key; confirm the unavailable state does not crash other pages.
- With Maps configured and a populated API response, pan/zoom and select markers; check coordinates, timestamps, photos, and verification text.
- With `{ "data": [] }`, verify the unmarked map and screen-reader status. With HTTP 404/500, malformed JSON payloads, or a stopped API, verify unavailable and Retry.
- Check keyboard navigation and Enter/Space marker activation; assess the inherited popup/image-viewer dismissal and focus behavior. Full popup keyboard handling is a follow-up.
- Check 390px and 1440px viewport widths; verify navigation and details do not overflow.
- With the backend/database configured, exercise existing login, logout, signup, and profile pages. Test Google sign-in only with Firebase configured.

## Course deliverables still required

The code migration and these notes do not replace the Canvas templates. Incorporate accurate contributions into the progress report, functional/non-functional requirements and use cases plus a preliminary class/sequence diagram into RD, and sections 1–2 of IT. Prepare the 5–7 minute increment video with next-increment plans and add its link to the progress report. Each student must submit the teammate evaluation. Create/link actual issues, commits, and PRs as required by the syllabus. No issues, PRs, commits, videos, or course submissions were created by this local migration.

## Syllabus review before the first commit

- Pulled `origin/main` to `af031a7` before preparing the frontend commit. The incoming detection-service work was retained, with no local backend modifications.
- Prepare the frontend change on `feat/increment-1-frontend` for an issue-linked PR. A local commit does not update GitHub source until the branch is pushed.
- The issue tracker contained PRs #1–#3 but no standalone feature/bug issues at review time. `increment-1-frontend-issue.md` is a proposed issue body, not an existing work item. Obtain a real issue number before adding the commit reference; do not substitute a made-up number or an unrelated PR number.
- Use the student's author identity and configured email. Git's fallback author name in this environment is `CodexSandboxOffline`, which is not suitable for the syllabus's individual contribution evidence. The documented student name is Thien Le.
- Keep the integration and visual-check items open until verified. The issue and later PR should distinguish completed migration work from inherited code and outstanding backend/browser work.
- Every member must contribute to the progress report, RD, IT, video, and source work; each member submits their own teammate evaluation. Completing this commit does not complete Increment 1.
- One pasted syllabus sentence says work items "that are linked to requirements in the RD document essentially do not exist," which is inconsistent with the surrounding traceability instructions. Do not rely on that wording to omit traceability: retain requirement-to-issue-to-commit/PR references and clarify the sentence with the instructor when preparing the final submission.
