import type { Request, Response } from "express";
import { DetectionService } from "../services/detection.service.ts";
import { createRoboflowImageAnalyzer } from "../services/roboflow-image-analyzer.ts";

export const DetectionController = {
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
