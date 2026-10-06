import { Router } from "express";
import {
  alongRouteBody,
  confirmBody,
  listQuery,
  PotholeController,
} from "../controllers/pothole.controller.ts";
import { authenticate } from "../middleware/auth.middleware.ts";
import { idParams, validate } from "../middleware/validate.middleware.ts";

export const potholeRouter = Router();

potholeRouter.get(
  "/",
  validate({ query: listQuery }),
  PotholeController.list,
);
potholeRouter.post(
  "/along-route",
  validate({ body: alongRouteBody }),
  PotholeController.alongRoute,
);
potholeRouter.get(
  "/:id",
  validate({ params: idParams }),
  PotholeController.getById,
);
potholeRouter.post(
  "/:id/confirmations",
  authenticate,
  validate({ params: idParams, body: confirmBody }),
  PotholeController.confirm,
);
