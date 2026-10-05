import { Router } from "express";
import { potholeRouter } from "./pothole.routes.ts";
import { detectionRouter } from "./detection.routes.ts";
import { healthRouter } from "./health.routes.ts";

export const router = Router();

router.use("/potholes", potholeRouter);
router.use("/detections", detectionRouter);
router.use("/health", healthRouter);
