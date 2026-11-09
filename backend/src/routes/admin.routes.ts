import { Router } from "express";
import {
  AdminController,
  reviewBody,
  reviewQueueQuery,
} from "../controllers/admin.controller.ts";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.ts";
import { idParams, validate } from "../middleware/validate.middleware.ts";

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

adminRouter.get(
  "/potholes",
  validate({ query: reviewQueueQuery }),
  AdminController.listPotholes,
);
adminRouter.get(
  "/potholes/:id",
  validate({ params: idParams }),
  AdminController.getPothole,
);
adminRouter.patch(
  "/potholes/:id/review",
  validate({ params: idParams, body: reviewBody }),
  AdminController.reviewPothole,
);
