import { pool } from "../db.ts";
import { POTHOLE_COLUMNS, type Pothole } from "./pothole.model.ts";

export type ReviewStatus = "pending" | "verified" | "rejected";
export type ReviewDecision = Exclude<ReviewStatus, "pending">;

export type ReviewedPothole = Pothole & {
  reviewStatus: ReviewStatus;
  reviewedBy: number | null;
  reviewedAt: Date | null;
};

export type ReviewQueueItem = ReviewedPothole & {
  stillThereCount: number;
  notThereCount: number;
};

export type ReviewDetection = {
  id: number;
  latitude: number;
  longitude: number;
  confidence: number;
  modelVersion: string;
  gpsAccuracy: number | null;
  imageUrl: string | null;
  capturedAt: Date;
};

const REVIEW_COLUMNS = `${POTHOLE_COLUMNS},
  review_status AS "reviewStatus",
  reviewed_by AS "reviewedBy",
  reviewed_at AS "reviewedAt"`;

export const PotholeReviewModel = {
  findQueue: async (options: {
    status: ReviewStatus;
    limit: number;
  }): Promise<ReviewQueueItem[]> => {
    const { rows } = await pool.query<ReviewQueueItem>(
      `SELECT ${REVIEW_COLUMNS},
         (SELECT count(*) FROM confirmations c
          WHERE c.pothole_id = potholes.id AND c.still_there)::int AS "stillThereCount",
         (SELECT count(*) FROM confirmations c
          WHERE c.pothole_id = potholes.id AND NOT c.still_there)::int AS "notThereCount"
       FROM potholes
       WHERE review_status = $1
       ORDER BY last_detected_at DESC
       LIMIT $2`,
      [options.status, options.limit],
    );
    return rows;
  },

  findById: async (id: number): Promise<ReviewedPothole | null> => {
    const { rows } = await pool.query<ReviewedPothole>(
      `SELECT ${REVIEW_COLUMNS} FROM potholes WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  },

  findDetections: async (potholeId: number): Promise<ReviewDetection[]> => {
    const { rows } = await pool.query<ReviewDetection>(
      `SELECT id,
         ST_Y(location::geometry) AS latitude,
         ST_X(location::geometry) AS longitude,
         confidence,
         model_version AS "modelVersion",
         gps_accuracy AS "gpsAccuracy",
         CASE WHEN image_path IS NULL THEN NULL
           ELSE '/api/uploads/' || image_path END AS "imageUrl",
         captured_at AS "capturedAt"
       FROM detections
       WHERE pothole_id = $1
       ORDER BY captured_at DESC`,
      [potholeId],
    );
    return rows;
  },

  recordDecision: async (options: {
    id: number;
    decision: ReviewDecision;
    reviewerId: number;
  }): Promise<ReviewedPothole | null> => {
    const { rows } = await pool.query<ReviewedPothole>(
      `UPDATE potholes SET
         review_status = $2::text,
         verified = ($2::text = 'verified'),
         reviewed_by = $3,
         reviewed_at = now()
       WHERE id = $1
       RETURNING ${REVIEW_COLUMNS}`,
      [options.id, options.decision, options.reviewerId],
    );
    return rows[0] ?? null;
  },
};
