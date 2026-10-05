import axios from "axios";
import z from "zod";

// PostgreSQL IDs are numeric; normalize IDs for React keys and future routes.
const PotholeSchema = z.object({
  _id: z.union([z.string(), z.number()]).transform(String),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  confidenceScore: z.number().min(0).max(1),
  detectedAt: z.string(),
  verified: z.boolean(),
  detectionCount: z.number(),
  images: z.array(z.string()),
});

export type Pothole = z.infer<typeof PotholeSchema>;

export const potholeService = {
  async getPotholes(signal?: AbortSignal): Promise<Pothole[]> {
    const response = await axios.get(
      `${import.meta.env.VITE_API_URL || ""}/api/potholes`,
      { params: { limit: 100 }, signal, timeout: 15000 },
    );
    // Invalid payloads must be errors, rather than appearing as an empty map.
    return z.object({ data: z.array(PotholeSchema) }).parse(response.data).data;
  },
};
