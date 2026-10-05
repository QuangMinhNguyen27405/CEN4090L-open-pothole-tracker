import type { Request, Response } from "express";

export const PotholeController = {
  async list(req: Request, res: Response) {
    res.status(501).json({ error: "Not implemented" });
  },

  async getById(req: Request, res: Response) {
    res.status(501).json({ error: "Not implemented" });
  },

  async alongRoute(req: Request, res: Response) {
    res.status(501).json({ error: "Not implemented" });
  },

  async confirm(req: Request, res: Response) {
    res.status(501).json({ error: "Not implemented" });
  },
};
