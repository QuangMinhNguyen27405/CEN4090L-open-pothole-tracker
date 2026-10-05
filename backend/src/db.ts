import pg from "pg";

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const POTHOLE_COLUMNS = `id, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
  confidence, detection_count, verified, created_at, last_detected_at`;
