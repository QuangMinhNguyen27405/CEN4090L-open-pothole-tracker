import { Router } from "express";
import { potholeRouter } from "./pothole.routes.ts";
import { detectionRouter } from "./detection.routes.ts";
import { healthRouter } from "./health.routes.ts";
import { authRouter } from "./auth.routes.ts";
import { userRouter } from "./user.routes.ts";
import { nearbyPotholesRouter } from "./nearby-potholes.routes.ts";

export const router = Router();

router.use("/potholes/nearby", nearbyPotholesRouter);
router.use("/potholes", potholeRouter);
router.use("/detections", detectionRouter);
router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/users", userRouter);
