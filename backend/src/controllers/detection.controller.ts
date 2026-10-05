import type { Request, Response } from "express";

export const DetectionController = {
  async create(req: Request, res: Response) {
    res.status(501).json({ error: "Not implemented" });
  },

  async uploadImage(req: Request, res: Response) {
    res.status(501).json({ error: "Not implemented" });
  },
};
