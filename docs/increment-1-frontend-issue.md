# Migrate Increment 1 frontend foundation with original visual design

## Scope

Migrate the frontend foundation from the team's previous Open Pothole Map project while preserving its original appearance. Responsibility: Thien Le (cl23m), Frontend, Maps & User Experience.

Features tracked here (draft requirement IDs are documented in `docs/increment-1-frontend.md` and must be reconciled with the official RD document):

- FE-01: React/Vite app setup, public home/map routes, navigation, and themes.
- FE-02: Public interactive Google map and pothole markers.
- FE-03: Original anchored read-only pothole details, thumbnails, and image viewer.
- FE-04: Original public claim-resource page.
- FE-05: Distinct request status and retry after a failed pothole request.
- NFR-FE-01/02: Review desktop/mobile behavior and keyboard interaction while preserving the original UI.

Reuse source: `open-pothole-map-repo` at `b2eb60bf4dc6ba4c05445ad184f148eb12c21893`. Retain its MIT notice and distinguish reused code from this increment's migration/integration work.

## Integration fixes included

- Restore missing shared UI and frontend setup needed by the existing auth/profile pages.
- Normalize PostgreSQL numeric pothole IDs without changing their presentation.
- Add the development API proxy and avoid recursive logout requests on a failed logout.
- Initialize Firebase only for Google sign-in so missing Firebase settings do not prevent public pages from loading.
- Replace the profile page's untyped error handler with an Axios type guard.

## Acceptance criteria

- [ ] Frontend production build and lint checks pass; warnings are recorded.
- [ ] Public home, navigation, themes, and map render with the original visual design.
- [ ] A populated real pothole API response produces selectable markers and original detail popups/images.
- [ ] Loading, empty, failed requests, and retry are verified.
- [ ] Desktop/mobile and keyboard checks are recorded; any remaining defects stay documented and open.
- [ ] Commit(s) and the resolving PR are linked to this issue; contribution and requirement references are reflected in course documents.

## Current evidence and unresolved work

Build and TypeScript checks pass; lint reports no errors and two inherited login hook warnings. Thirteen key presentation files/assets match the original bytes; marker animation, read-only popup, and image markup were compared with the source.

The public `GET /api/potholes` endpoint is not implemented in the current backend. Real data integration, configured Google Maps, exact browser visual comparison, desktop/mobile interaction, and public-link checks remain unverified. The inherited popup still needs full keyboard dismissal/focus review. Keep these items open; the first migration commit does not establish completion of them.

Camera detection, driving/directions, live notifications, and community/admin controls belong to later increments and will reuse their original UI.
