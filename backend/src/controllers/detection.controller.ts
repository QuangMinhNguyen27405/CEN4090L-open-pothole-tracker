import type { Request, Response } from "express";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  latitude,
  longitude,
  type IdParams,
} from "../middleware/validate.middleware.ts";
import { DetectionModel } from "../models/detection.model.ts";
import { DetectionService } from "../services/detection.service.ts";
import { createRoboflowImageAnalyzer } from "../services/roboflow-image-analyzer.ts";
import { UPLOAD_DIR } from "../storage.ts";

export const createDetectionBody = z.object({
  latitude,
  longitude,
  confidenceScore: z.number().min(0).max(1),
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
    const detection = await DetectionModel.create({
      ...req.body,
      userId: req.user?.id,
    });
    res.status(201).json({ data: detection });
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
    const imageUrl = `/api/uploads/${file}`;
    if (!(await DetectionModel.addImage(id, imageUrl))) {
      res.status(404).json({ error: "Detection not found" });
      return;
    }
    await writeFile(path.join(UPLOAD_DIR, file), req.body);
    res.json({ data: { imageUrl } });
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
