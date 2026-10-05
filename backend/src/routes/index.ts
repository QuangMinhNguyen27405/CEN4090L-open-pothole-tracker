import { Router } from "express";
import { potholeRouter } from "./pothole.routes.ts";
import { detectionRouter } from "./detection.routes.ts";

export const router = Router();

router.use("/potholes", potholeRouter);
router.use("/detections", detectionRouter);
