import type { Request, Response } from "express";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { pool } from "../db.ts";
import {
  latitude,
  longitude,
  type IdParams,
} from "../middleware/validate.middleware.ts";
import {
  DetectionService,
  type DetectionResult,
} from "../services/detection.service.ts";
import { persistDetection } from "../services/detection-report.service.ts";
import { createRoboflowImageAnalyzer } from "../services/roboflow-image-analyzer.ts";
import { UPLOAD_DIR } from "../storage.ts";

export const createDetectionBody = z.object({
  lat: latitude,
  lng: longitude,
  confidence: z.number().min(0).max(1),
  modelVersion: z.string().min(1).max(100),
  capturedAt: z.iso.datetime({ offset: true }),
  gpsAccuracy: z.number().nonnegative().optional(),
});

type CreateDetectionBody = z.infer<typeof createDetectionBody>;

const queryNumber = z
  .string()
  .trim()
  .min(1)
  .pipe(z.coerce.number<string>().finite());

export const reportDetectionQuery = z.object({
  lat: queryNumber.pipe(z.number().min(-90).max(90)),
  lng: queryNumber.pipe(z.number().min(-180).max(180)),
  capturedAt: z.iso.datetime({ offset: true }),
  gpsAccuracy: queryNumber.pipe(z.number().nonnegative()).optional(),
});

type ReportDetectionQuery = z.infer<typeof reportDetectionQuery>;

const POTHOLE_CONFIDENCE_THRESHOLD = 0.6;
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function imageExtension(data: Buffer): "jpg" | "png" | null {
  if (data.subarray(0, JPEG.length).equals(JPEG)) return "jpg";
  if (data.subarray(0, PNG.length).equals(PNG)) return "png";
  return null;
}

async function saveDetectionImage(
  id: number,
  image: Buffer,
  ext: "jpg" | "png",
) {
  const file = `detection-${id}.${ext}`;
  const imageUrl = `/api/uploads/${file}`;
  const { rowCount } = await pool.query(
    `WITH detection AS (
       UPDATE detections SET image_path = $2 WHERE id = $1
       RETURNING pothole_id
     )
     UPDATE potholes
     SET image_urls = array_append(array_remove(image_urls, $3), $3)
     FROM detection WHERE potholes.id = detection.pothole_id`,
    [id, file, imageUrl],
  );
  if (!rowCount) return null;
  await writeFile(path.join(UPLOAD_DIR, file), image);
  return imageUrl;
}

export const DetectionController = {
  async create(req: Request<{}, unknown, CreateDetectionBody>, res: Response) {
    const result = await persistDetection(req.body);
    res.status(201).json(result);
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
    const imageUrl = await saveDetectionImage(id, req.body, ext);
    if (!imageUrl) {
      res.status(404).json({ error: "Detection not found" });
      return;
    }
    res.json({ image_url: imageUrl });
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

  async report(req: Request<{}, unknown, Buffer, ReportDetectionQuery>, res: Response) {
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
    const ext = imageExtension(req.body);
    if (!ext) {
      res.status(400).json({ error: "Body is not a JPEG or PNG image" });
      return;
    }

    let result: DetectionResult;
    try {
      const detectionService = new DetectionService(
        createRoboflowImageAnalyzer({
          apiKey: ROBOFLOW_API_KEY,
          projectId: ROBOFLOW_PROJECT_ID,
          modelVersion: ROBOFLOW_MODEL_VERSION,
        }),
      );
      result = await detectionService.processFrame(req.body);
    } catch (error) {
      console.error("Image detection failed:", error);
      res.status(502).json({ error: "Image detection failed" });
      return;
    }

    const prediction = result.predictions
      .filter(
        (item) =>
          item.class.trim().toLowerCase() === "pothole" &&
          item.confidence >= POTHOLE_CONFIDENCE_THRESHOLD,
      )
      .sort((a, b) => b.confidence - a.confidence)[0];

    if (!prediction) {
      res.json({ detected: false, predictions: result.predictions });
      return;
    }

    const saved = await persistDetection({
      lat: req.query.lat,
      lng: req.query.lng,
      confidence: prediction.confidence,
      modelVersion: ROBOFLOW_MODEL_VERSION,
      capturedAt: req.query.capturedAt,
      gpsAccuracy: req.query.gpsAccuracy,
    });
    const imageUrl = await saveDetectionImage(saved.id, req.body, ext);
    if (!imageUrl) {
      res.status(500).json({ error: "Could not attach the uploaded image" });
      return;
    }

    res.status(201).json({
      detected: true,
      ...saved,
      image_url: imageUrl,
      predictions: result.predictions,
    });
  },
};
