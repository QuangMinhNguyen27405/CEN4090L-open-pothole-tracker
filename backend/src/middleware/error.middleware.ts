import type { ErrorRequestHandler } from "express";
import { z } from "zod";

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: err.issues });
    return;
  }
  next(err);
};
