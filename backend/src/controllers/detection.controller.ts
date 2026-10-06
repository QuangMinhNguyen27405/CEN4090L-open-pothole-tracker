import type { Request, Response } from "express";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { pool, POTHOLE_COLUMNS } from "../db.ts";
import {
  latitude,
  longitude,
  type IdParams,
} from "../middleware/validate.middleware.ts";
import { DetectionService } from "../services/detection.service.ts";
import { createRoboflowImageAnalyzer } from "../services/roboflow-image-analyzer.ts";
import { UPLOAD_DIR } from "../storage.ts";

const MERGE_RADIUS_METERS = 10;

export const createDetectionBody = z.object({
  lat: latitude,
  lng: longitude,
  confidence: z.number().min(0).max(1),
  modelVersion: z.string().min(1).max(100),
  capturedAt: z.iso.datetime({ offset: true }),
  gpsAccuracy: z.number().nonnegative().optional(),
});

type CreateDetectionBody = z.infer<typeof createDetectionBody>;

const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function imageExtension(data: Buffer) {
  if (data.subarray(0, JPEG.length).equals(JPEG)) return "jpg";
  if (data.subarray(0, PNG.length).equals(PNG)) return "png";
  return null;
}

export const DetectionController = {
  async create(req: Request<{}, unknown, CreateDetectionBody>, res: Response) {
    const d = req.body;
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
        d.lng,
        d.lat,
        d.confidence,
        MERGE_RADIUS_METERS,
        d.modelVersion,
        d.gpsAccuracy ?? null,
        d.capturedAt,
      ],
    );
    const { detection_id, ...pothole } = rows[0];
    res.status(201).json({ id: detection_id, pothole });
  },

  async uploadImage(req: Request<IdParams>, res: Response) {
    const { id } = req.params;
    if (!Buffer.isBuffer(req.body)) {
      res
        .status(415)
        .json({ error: "Send the image body as image/jpeg or image/png" });
      return;
    }
    const ext = imageExtension(req.body);
    if (!ext) {
      res.status(400).json({ error: "Body is not a JPEG or PNG image" });
      return;
    }
    const file = `detection-${id}.${ext}`;
    const { rowCount } = await pool.query(
      "UPDATE detections SET image_path = $2 WHERE id = $1",
      [id, file],
    );
    if (!rowCount) {
      res.status(404).json({ error: "Detection not found" });
      return;
    }
    await writeFile(path.join(UPLOAD_DIR, file), req.body);
    res.json({ image_url: `/uploads/${file}` });
  },

  async analyze(req: Request, res: Response) {
    const { ROBOFLOW_API_KEY, ROBOFLOW_PROJECT_ID, ROBOFLOW_MODEL_VERSION } =
      process.env;

    if (!ROBOFLOW_API_KEY || !ROBOFLOW_PROJECT_ID || !ROBOFLOW_MODEL_VERSION) {
      res.status(503).json({ error: "Detection service is not configured" });
      return;
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "A non-empty JPEG or PNG image is required" });
      return;
    }

    try {
      const detectionService = new DetectionService(
        createRoboflowImageAnalyzer({
          apiKey: ROBOFLOW_API_KEY,
          projectId: ROBOFLOW_PROJECT_ID,
          modelVersion: ROBOFLOW_MODEL_VERSION,
        }),
      );
      const result = await detectionService.processFrame(req.body);
      res.status(200).json(result);
    } catch (error) {
      console.error("Image detection failed:", error);
      res.status(502).json({ error: "Image detection failed" });
    }
  },
};
