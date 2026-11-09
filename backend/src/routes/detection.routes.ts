import express, { Router } from "express";
import {
  createDetectionBody,
  DetectionController,
  reportDetectionQuery,
} from "../controllers/detection.controller.ts";
import { authenticate } from "../middleware/auth.middleware.ts";
import { idParams, validate } from "../middleware/validate.middleware.ts";

export const detectionRouter = Router();

detectionRouter.post(
  "/",
  authenticate,
  validate({ body: createDetectionBody }),
  DetectionController.create,
);
detectionRouter.put(
  "/:id/image",
  authenticate,
  validate({ params: idParams }),
  express.raw({ type: ["image/jpeg", "image/png"], limit: "5mb" }),
  DetectionController.uploadImage,
);
detectionRouter.post(
  "/analyze",
  authenticate,
  express.raw({ type: ["image/jpeg", "image/png"], limit: "5mb" }),
  DetectionController.analyze,
);
detectionRouter.post(
  "/report",
  authenticate,
  validate({ query: reportDetectionQuery }),
  express.raw({ type: ["image/jpeg", "image/png"], limit: "5mb" }),
  DetectionController.report,
);
