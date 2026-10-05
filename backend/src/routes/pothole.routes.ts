import { Router } from "express";
import { PotholeController } from "../controllers/pothole.controller.ts";
import { idParams, validate } from "../middleware/validate.middleware.ts";

export const potholeRouter = Router();

potholeRouter.get("/", PotholeController.list);
potholeRouter.post("/along-route", PotholeController.alongRoute);
potholeRouter.get(
  "/:id",
  validate({ params: idParams }),
  PotholeController.getById,
);
potholeRouter.post(
  "/:id/confirmations",
  validate({ params: idParams }),
  PotholeController.confirm,
);
