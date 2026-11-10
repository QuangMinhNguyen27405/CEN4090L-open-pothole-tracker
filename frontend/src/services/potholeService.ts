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

const ConfirmationSummarySchema = z.object({
  still_there: z.number().int().nonnegative(),
  not_there: z.number().int().nonnegative(),
});

export type ConfirmationSummary = z.infer<typeof ConfirmationSummarySchema>;

const ViewerConfirmationSummarySchema = ConfirmationSummarySchema.extend({
  my_response: z.boolean().nullable(),
});

export type ViewerConfirmationSummary = z.infer<typeof ViewerConfirmationSummarySchema>;

const DetectionReportSchema = z.object({ detected: z.boolean() });

export const potholeService = {
  async getNearby(point: { lat: number; lng: number }, signal?: AbortSignal): Promise<Pothole[]> {
    const response = await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/potholes/nearby`, {
      params: { latitude: point.lat, longitude: point.lng, radiusMeters: 200, limit: 100 }, signal, timeout: 10000,
    });
    return z.array(PotholeSchema).parse(response.data);
  },
  async getPotholes(signal?: AbortSignal): Promise<Pothole[]> {
    const response = await axios.get(
      `${import.meta.env.VITE_API_URL || ""}/api/potholes`,
      { params: { limit: 100 }, signal, timeout: 15000 },
    );
    // Invalid payloads must be errors, rather than appearing as an empty map.
    return z.object({ data: z.array(PotholeSchema) }).parse(response.data).data;
  },

  async getConfirmations(
    potholeId: string,
    signal?: AbortSignal,
  ): Promise<ViewerConfirmationSummary> {
    const response = await axios.get(
      `${import.meta.env.VITE_API_URL || ""}/api/potholes/${encodeURIComponent(potholeId)}/confirmations`,
      { withCredentials: true, timeout: 15000, signal },
    );
    return ViewerConfirmationSummarySchema.parse(response.data);
  },

  async confirm(
    potholeId: string,
    stillThere: boolean,
  ): Promise<ConfirmationSummary> {
    const response = await axios.post(
      `${import.meta.env.VITE_API_URL || ""}/api/potholes/${encodeURIComponent(potholeId)}/confirmations`,
      { stillThere },
      { withCredentials: true, timeout: 15000 },
    );
    return ConfirmationSummarySchema.parse(response.data);
  },

  async reportDetection(frame: {
    image: Blob;
    lat: number;
    lng: number;
    capturedAt: string;
    gpsAccuracy: number;
  }, signal?: AbortSignal): Promise<{ detected: boolean }> {
    const params = new URLSearchParams({
      lat: String(frame.lat),
      lng: String(frame.lng),
      capturedAt: frame.capturedAt,
      gpsAccuracy: String(frame.gpsAccuracy),
    });
    const response = await axios.post(
      `${import.meta.env.VITE_API_URL || ""}/api/detections/report?${params}`,
      frame.image,
      {
        headers: { "Content-Type": frame.image.type },
        withCredentials: true,
        timeout: 30000,
        signal,
      },
    );
    return DetectionReportSchema.parse(response.data);
  },
};
