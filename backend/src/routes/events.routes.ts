import { Router } from "express";
import { subscribeToPotholeUpdates } from "../services/pothole-events.service.ts";

export const eventsRouter = Router();

eventsRouter.get("/", (_req, res) => {
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  subscribeToPotholeUpdates(res);
});
