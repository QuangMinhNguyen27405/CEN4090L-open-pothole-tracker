import z from "zod";
import { request } from "@/utils/api";

const ReviewStatusSchema = z.enum(["pending", "verified", "rejected"]);

const ReviewedPotholeSchema = z.object({
  _id: z.union([z.string(), z.number()]).transform(String),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  confidenceScore: z.number().min(0).max(1),
  detectionCount: z.number(),
  images: z.array(z.string()),
  detectedAt: z.string(),
  reviewStatus: ReviewStatusSchema,
  reviewedAt: z.string().nullable(),
});

const ReviewQueueItemSchema = ReviewedPotholeSchema.extend({
  stillThereCount: z.number(),
  notThereCount: z.number(),
});

const ReviewDetailSchema = ReviewedPotholeSchema.extend({
  detections: z.array(
    z.object({
      id: z.number(),
      confidence: z.number(),
      modelVersion: z.string(),
      gpsAccuracy: z.number().nullable(),
      capturedAt: z.string(),
    }),
  ),
  confirmations: z.array(
    z.object({
      userId: z.number(),
      username: z.string().nullable().optional(),
      status: z.enum(["still_there", "not_there"]),
      confirmedAt: z.string(),
    }),
  ),
  confirmationSummary: z.object({
    still_there: z.number(),
    not_there: z.number(),
    total: z.number(),
  }),
});

export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
export type ReviewDecision = Exclude<ReviewStatus, "pending">;
export type ReviewQueueItem = z.infer<typeof ReviewQueueItemSchema>;
export type ReviewDetail = z.infer<typeof ReviewDetailSchema>;

export const adminService = {
  getQueue: (status: ReviewStatus): Promise<ReviewQueueItem[]> =>
    request({
      method: "GET",
      url: "/admin/potholes",
      data: { status, limit: 100 },
      schema: z.object({ data: z.array(ReviewQueueItemSchema) }),
      options: { includeOnlyDataField: true },
    }),

  getPothole: (id: string): Promise<ReviewDetail> =>
    request({
      method: "GET",
      url: `/admin/potholes/${encodeURIComponent(id)}`,
      schema: z.object({ data: ReviewDetailSchema }),
      options: { includeOnlyDataField: true },
    }),

  review: (id: string, decision: ReviewDecision) =>
    request({
      method: "PATCH",
      url: `/admin/potholes/${encodeURIComponent(id)}/review`,
      data: { decision },
      schema: z.object({ data: ReviewedPotholeSchema }),
      options: { includeOnlyDataField: true },
    }),
};
