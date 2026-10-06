import { pool } from "../db.ts";
import { POTHOLE_COLUMNS, type Pothole } from "./pothole.model.ts";

const MERGE_RADIUS_METERS = 10;

export const DetectionModel = {
  create: async (data: {
    latitude: number;
    longitude: number;
    confidenceScore: number;
    modelVersion: string;
    capturedAt: string;
    gpsAccuracy?: number;
    userId?: number;
  }): Promise<{ id: number; pothole: Pothole }> => {
    const { rows } = await pool.query(
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
           confidence = greatest(confidence, $3)
         FROM nearby WHERE id = nearby_id
         RETURNING ${POTHOLE_COLUMNS}
       ),
       inserted AS (
         INSERT INTO potholes (location, confidence, reported_by)
         SELECT geog, $3, $8 FROM point
         WHERE NOT EXISTS (SELECT 1 FROM nearby)
         RETURNING ${POTHOLE_COLUMNS}
       ),
       pothole AS (
         SELECT * FROM updated UNION ALL SELECT * FROM inserted
       ),
       detection AS (
         INSERT INTO detections
           (pothole_id, location, confidence, model_version, gps_accuracy, captured_at)
         SELECT pothole."_id", point.geog, $3, $5, $6, $7 FROM pothole, point
         RETURNING id
       )
       SELECT detection.id AS "detectionId", pothole.* FROM detection, pothole`,
      [
        data.longitude,
        data.latitude,
        data.confidenceScore,
        MERGE_RADIUS_METERS,
        data.modelVersion,
        data.gpsAccuracy ?? null,
        data.capturedAt,
        data.userId ?? null,
      ]
    );
    const { detectionId, ...pothole } = rows[0];
    return { id: detectionId, pothole };
  },

  addImage: async (detectionId: number, imageUrl: string): Promise<boolean> => {
    const { rowCount } = await pool.query(
      `UPDATE potholes p
          SET image_urls = array_append(array_remove(p.image_urls, $2), $2)
         FROM detections d
        WHERE d.id = $1 AND p.id = d.pothole_id`,
      [detectionId, imageUrl]
    );
    return rowCount === 1;
  },
};
