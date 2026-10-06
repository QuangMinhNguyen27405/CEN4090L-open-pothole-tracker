import type { Request, Response } from "express";
import { z } from "zod";
import { PotholeModel } from "../models/pothole.model.ts";

export const listQuery = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
});

type ListQuery = z.infer<typeof listQuery>;

export const PotholeController = {
  async list(req: Request<{}, unknown, unknown, ListQuery>, res: Response) {
    const potholes = await PotholeModel.findRecent(req.query.limit);
    res.json({ data: potholes });
  },
};
