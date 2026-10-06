import { Router } from "express";
import { z } from "zod";
import { NearbyPotholesModel } from "../models/nearby-potholes.model.ts";

const queryNumber = z.string().trim().min(1).pipe(z.coerce.number<string>().finite());

export const nearbyPotholesQuery = z.object({
  latitude: queryNumber.pipe(z.number().min(-90).max(90)),
  longitude: queryNumber.pipe(z.number().min(-180).max(180)),
  radiusMeters: queryNumber.pipe(z.number().positive().max(5000)).default(250),
  limit: queryNumber.pipe(z.number().int().positive().max(100)).default(50),
});

export const nearbyPotholesRouter = Router();

nearbyPotholesRouter.get("/", async (req, res) => {
  const query = nearbyPotholesQuery.parse(req.query);
  const potholes = await NearbyPotholesModel.findNearby(query);
  res.json(potholes);
});
