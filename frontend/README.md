# Increment 1 frontend

React, TypeScript, Vite, Tailwind CSS, and Google Maps frontend for Open Pothole Tracker. Adapted from the team's previous Open Pothole Map project; see [migration notes](../docs/increment-1-frontend.md) and [original license](LICENSE).

## Run locally

Use Node.js 24 or later (matching the current backend). From this directory:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Set `VITE_GOOGLE_MAPS_API_KEY` in `.env` to a key for a project with Maps JavaScript API enabled, and set `VITE_GOOGLE_MAPS_ID` to your map ID. Use the original project's map configuration to reproduce its appearance. Without a Maps key the map shows an unavailable message.

Leave `VITE_API_URL` blank for local development: Vite forwards `/api` to `http://localhost:8000`, including the existing authentication requests. Run/configure the backend separately. If its port changes, update `vite.config.ts`. For deployment, configure your host to forward `/api` to the backend, or supply an API origin and configure backend CORS and cookies accordingly. Configure the host to serve `index.html` for client routes such as `/map`.

Firebase environment settings are needed only for Google sign-in. Password login uses the existing backend. No credentials were copied from the previous project.

```powershell
npm run build
npm run lint
```

## Current scope

- Public home page with claim-resource links, navigation, and light/dark themes.
- Original map presentation: location-centered view at zoom 17, location arrow, hidden default Google controls, animated pothole markers, anchored detail popups, thumbnails, and full-screen image viewer.
- Nonvisual loading/empty status and an error-only Retry control, with no additional panel on the successful map view.
- Existing login, signup, and profile pages wired into the app.

The new backend's pothole router is currently empty. Until `GET /api/potholes?limit=100` is implemented, the map displays a data-unavailable message. A successful empty result must be `{ "data": [] }`; a failed request is never presented as an empty result. Markers and details require a populated successful response. See the API contract in the migration notes.

Camera detection, driving directions, live updates, and notifications are deferred. This migration does not implement or certify the existing backend/authentication features.

## Visual fidelity

The final product must match `open-pothole-map-repo`. The original home page, navigation, layout, styles, and image viewer are retained. The marker popup retains its original read-only markup. Increment 1 omits deferred camera/driving/community controls; add their original components when those features are migrated. See the repository's `AGENTS.md` for this persistent constraint. Exact browser-level parity remains to be checked with matching map configuration, data, viewport, theme, and location.
