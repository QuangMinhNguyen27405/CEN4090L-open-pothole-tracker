import { pool } from "../db.ts";

export type Pothole = {
  _id: number;
  latitude: number;
  longitude: number;
  confidenceScore: number;
  detectionCount: number;
  verified: boolean;
  userId: number | null;
  images: string[];
  detectedAt: Date;
  createdAt: Date;
};

export const POTHOLE_COLUMNS = `
  id AS "_id",
  ST_Y(location::geometry) AS latitude,
  ST_X(location::geometry) AS longitude,
  confidence AS "confidenceScore",
  detection_count AS "detectionCount",
  verified,
  reported_by AS "userId",
  image_urls AS images,
  last_detected_at AS "detectedAt",
  created_at AS "createdAt"`;

export const PotholeModel = {
  create: async (data: {
    latitude: number;
    longitude: number;
    confidenceScore: number;
    images: string[];
    verified: boolean;
    detectionCount: number;
    userId?: number | null;
  }): Promise<Pothole> => {
    const { rows } = await pool.query<Pothole>(
      `INSERT INTO potholes
         (location, confidence, image_urls, verified, detection_count, reported_by)
       VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3, $4, $5, $6, $7)
       RETURNING ${POTHOLE_COLUMNS}`,
      [
        data.longitude,
        data.latitude,
        data.confidenceScore,
        data.images,
        data.verified,
        data.detectionCount,
        data.userId ?? null,
      ]
    );
    return rows[0]!;
  },

  findRecent: async (limit: number): Promise<Pothole[]> => {
    const { rows } = await pool.query<Pothole>(
      `SELECT ${POTHOLE_COLUMNS} FROM potholes
       ORDER BY last_detected_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  },
};
