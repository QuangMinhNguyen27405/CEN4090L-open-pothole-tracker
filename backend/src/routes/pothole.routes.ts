import { Router } from "express";
import {
  listQuery,
  PotholeController,
} from "../controllers/pothole.controller.ts";
import { validate } from "../middleware/validate.middleware.ts";

export const potholeRouter = Router();

potholeRouter.get(
  "/",
  validate({ query: listQuery }),
  PotholeController.list,
);
