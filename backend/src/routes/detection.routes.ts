import express, { Router } from "express";
import { DetectionController } from "../controllers/detection.controller.ts";

export const detectionRouter = Router();

detectionRouter.post(
  "/analyze",
  express.raw({ type: ["image/jpeg", "image/png"], limit: "5mb" }),
  DetectionController.analyze,
);
