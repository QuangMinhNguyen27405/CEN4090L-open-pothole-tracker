import express, { Router } from "express";
import { DetectionController } from "../controllers/detection.controller.ts";
import { idParams, validate } from "../middleware/validate.middleware.ts";

export const detectionRouter = Router();

detectionRouter.post("/", DetectionController.create);
detectionRouter.put(
  "/:id/image",
  validate({ params: idParams }),
  express.raw({ type: ["image/jpeg", "image/png"], limit: "5mb" }),
  DetectionController.uploadImage,
);
