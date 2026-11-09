import { pool, POTHOLE_COLUMNS } from "../db.ts";

const MERGE_RADIUS_METERS = 10;

export type PersistDetectionInput = {
  lat: number;
  lng: number;
  confidence: number;
  modelVersion: string;
  capturedAt: string;
  gpsAccuracy?: number;
};

type PersistedDetectionRow = Record<string, unknown> & {
  detection_id: number;
};

export async function persistDetection(detection: PersistDetectionInput) {
  const { rows } = await pool.query<PersistedDetectionRow>(
    `WITH point AS (
       SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS geog
     ),
     nearby AS (
       SELECT p.id AS nearby_id FROM potholes p, point
       WHERE ST_DWithin(p.location, point.geog, $4)
       ORDER BY p.location <-> point.geog
       LIMIT 1
     ),
     updated AS (
       UPDATE potholes SET detection_count = detection_count + 1,
         last_detected_at = now(),
         confidence = greatest(confidence, $3),
         review_status = CASE WHEN review_status = 'rejected' THEN 'pending' ELSE review_status END,
         reviewed_by = CASE WHEN review_status = 'rejected' THEN NULL ELSE reviewed_by END,
         reviewed_at = CASE WHEN review_status = 'rejected' THEN NULL ELSE reviewed_at END
       FROM nearby WHERE id = nearby_id
       RETURNING ${POTHOLE_COLUMNS}
     ),
     inserted AS (
       INSERT INTO potholes (location, confidence)
       SELECT geog, $3 FROM point
       WHERE NOT EXISTS (SELECT 1 FROM nearby)
       RETURNING ${POTHOLE_COLUMNS}
     ),
     pothole AS (
       SELECT * FROM updated UNION ALL SELECT * FROM inserted
     ),
     detection AS (
       INSERT INTO detections
         (pothole_id, location, confidence, model_version, gps_accuracy, captured_at)
       SELECT pothole.id, point.geog, $3, $5, $6, $7 FROM pothole, point
       RETURNING id
     )
     SELECT detection.id AS detection_id, pothole.* FROM detection, pothole`,
    [
      detection.lng,
      detection.lat,
      detection.confidence,
      MERGE_RADIUS_METERS,
      detection.modelVersion,
      detection.gpsAccuracy ?? null,
      detection.capturedAt,
    ],
  );
  const { detection_id, ...pothole } = rows[0]!;
  return { id: detection_id, pothole };
}
