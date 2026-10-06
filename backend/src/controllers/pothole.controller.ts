import type { Request, Response } from "express";
import { z } from "zod";
import { pool, POTHOLE_COLUMNS } from "../db.ts";
import {
  latitude,
  longitude,
  type IdParams,
} from "../middleware/validate.middleware.ts";

export const boundsQuery = z.object({
  west: z.coerce.number().pipe(longitude),
  south: z.coerce.number().pipe(latitude),
  east: z.coerce.number().pipe(longitude),
  north: z.coerce.number().pipe(latitude),
});

export const alongRouteBody = z.object({
  coordinates: z.array(z.tuple([longitude, latitude])).min(2).max(10000),
  bufferMeters: z.number().positive().max(500).default(20),
});

export const confirmBody = z.object({
  stillThere: z.boolean(),
});

type BoundsQuery = z.infer<typeof boundsQuery>;
type AlongRouteBody = z.infer<typeof alongRouteBody>;
type ConfirmBody = z.infer<typeof confirmBody>;

export const PotholeController = {
  async list(req: Request<{}, unknown, unknown, BoundsQuery>, res: Response) {
    const { west, south, east, north } = req.query;
    const { rows } = await pool.query(
      `SELECT ${POTHOLE_COLUMNS} FROM potholes
       WHERE location && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
       LIMIT 1000`,
      [west, south, east, north],
    );
    res.json(rows);
  },

  async getById(req: Request<IdParams>, res: Response) {
    const { rows } = await pool.query(
      `SELECT ${POTHOLE_COLUMNS},
         array(
           SELECT '/uploads/' || image_path FROM detections
           WHERE pothole_id = potholes.id AND image_path IS NOT NULL
           ORDER BY captured_at DESC
         ) AS image_urls
       FROM potholes WHERE id = $1`,
      [req.params.id],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Pothole not found" });
      return;
    }
    res.json(rows[0]);
  },

  async alongRoute(req: Request<{}, unknown, AlongRouteBody>, res: Response) {
    const { coordinates, bufferMeters } = req.body;
    const line = JSON.stringify({ type: "LineString", coordinates });
    const { rows } = await pool.query(
      `SELECT ${POTHOLE_COLUMNS} FROM potholes
       WHERE ST_DWithin(location, ST_GeomFromGeoJSON($1)::geography, $2)
       ORDER BY ST_LineLocatePoint(ST_GeomFromGeoJSON($1), location::geometry)`,
      [line, bufferMeters],
    );
    res.json(rows);
  },

  async confirm(req: Request<IdParams, unknown, ConfirmBody>, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const { stillThere } = req.body;
    const saved = await pool
      .query(
        `INSERT INTO confirmations (pothole_id, user_id, still_there)
         VALUES ($1, $2, $3)
         ON CONFLICT (pothole_id, user_id)
         DO UPDATE SET still_there = EXCLUDED.still_there, created_at = now()`,
        [id, userId, stillThere],
      )
      .catch((err) => {
        if (err.code === "23503") return null;
        throw err;
      });
    if (!saved) {
      res.status(404).json({ error: "Pothole not found" });
      return;
    }
    const { rows } = await pool.query(
      `SELECT count(*) FILTER (WHERE still_there)::int AS still_there,
         count(*) FILTER (WHERE NOT still_there)::int AS not_there
       FROM confirmations WHERE pothole_id = $1`,
      [id],
    );
    res.json(rows[0]);
  },
};
