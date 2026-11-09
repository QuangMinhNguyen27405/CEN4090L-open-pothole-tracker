import type { Request, Response } from "express";
import { z } from "zod";
import type { IdParams } from "../middleware/validate.middleware.ts";
import { ConfirmationModel } from "../models/confirmation.model.ts";
import { PotholeReviewModel } from "../models/pothole-review.model.ts";
import { publishPotholeUpdate } from "../services/pothole-events.service.ts";

export const reviewQueueQuery = z.object({
  status: z.enum(["pending", "verified", "rejected"]).default("pending"),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const reviewBody = z.object({
  decision: z.enum(["verified", "rejected"]),
});

type ReviewQueueQuery = z.infer<typeof reviewQueueQuery>;
type ReviewBody = z.infer<typeof reviewBody>;

export const AdminController = {
  async listPotholes(req: Request<{}, unknown, unknown, ReviewQueueQuery>, res: Response) {
    res.json({ data: await PotholeReviewModel.findQueue(req.query) });
  },

  async getPothole(req: Request<IdParams>, res: Response) {
    const { id } = req.params;
    const [pothole, detections, confirmations] = await Promise.all([
      PotholeReviewModel.findById(id),
      PotholeReviewModel.findDetections(id),
      ConfirmationModel.findByPothole(id),
    ]);
    if (!pothole) {
      res.status(404).json({ message: "Pothole not found" });
      return;
    }
    res.json({
      data: {
        ...pothole,
        detections,
        confirmations,
        confirmationSummary: ConfirmationModel.summarize(confirmations),
      },
    });
  },

  async reviewPothole(req: Request<IdParams, unknown, ReviewBody>, res: Response) {
    const reviewed = await PotholeReviewModel.recordDecision({
      id: req.params.id,
      decision: req.body.decision,
      reviewerId: req.user!.id,
    });
    if (!reviewed) {
      res.status(404).json({ message: "Pothole not found" });
      return;
    }
    publishPotholeUpdate();
    res.json({ data: reviewed });
  },
};
