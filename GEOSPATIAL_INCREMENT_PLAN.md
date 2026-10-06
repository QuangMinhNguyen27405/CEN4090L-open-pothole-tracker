# Geospatial implementation plan

This plan covers Vinh Do's camera, GPS, and geospatial contributions. It aligns with FR-02, FR-04, FR-06, and FR-07 in [RD_REPORT.md](RD_REPORT.md). Each increment should produce a reviewable code contribution and a dated entry in [PR_REPORT.md](PR_REPORT.md) when its PR is submitted.

| Increment | Focus | Deliverable |
| --- | --- | --- |
| 1 | Nearby lookup | A validated API that returns stored potholes within a distance of a GPS point, closest first. |
| 2 | Camera and GPS capture | A browser flow that requests camera and location access, shows permission/error states, and sends a captured frame with its location to the API. |
| 3 | Detection-to-location integration | Associate accepted detections with GPS data, check nearby reports for duplicates, and connect the result to the map workflow. |

## Increment 1: nearby lookup

**Purpose:** Give the map and future duplicate-matching flow a shared way to find potholes close to a coordinate. The existing `potholes.location` PostGIS geography column and GiST index support a distance search in meters.

**API:** `GET /api/potholes/nearby?latitude=30.4&longitude=-84.3&radiusMeters=250&limit=50`

| Query parameter | Rule |
| --- | --- |
| `latitude` | Required; number from -90 to 90. |
| `longitude` | Required; number from -180 to 180. |
| `radiusMeters` | Optional; greater than 0 and at most 5000; defaults to 250. |
| `limit` | Optional; integer from 1 to 100; defaults to 50. |

The response is an array of pothole records in ascending distance order. Each record includes `distanceMeters`. Invalid query values return HTTP 400. A successful search with no matches returns `[]`.

**Acceptance checks:** Confirm valid and invalid request behavior with automated HTTP tests; run the TypeScript checker; then exercise the spatial query against a PostGIS database with known pothole coordinates. Verify boundary inclusion, distance ordering, and the index plan using representative data before relying on this endpoint for a larger map view or duplicate matching.
