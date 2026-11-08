import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { after, mock, test } from "node:test";
import express from "express";
import sharp from "sharp";
import { pool } from "../src/db.ts";
import { errorHandler } from "../src/middleware/error.middleware.ts";
import { router } from "../src/routes/index.ts";

const app = express();
app.use(express.json());
app.use("/api", router);
app.use(errorHandler);

const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("Expected a TCP address");
const endpoint = `http://127.0.0.1:${address.port}/api/detections/report`;

after(() => server.close());

type ReportResponse = {
  detected?: boolean;
  id?: number;
  pothole?: { confidence?: number };
  image_url?: string;
};

const postImage = (url: string, image: Buffer) =>
  new Promise<{ status: number; body: ReportResponse }>((resolve, reject) => {
    const request = httpRequest(
      new URL(url),
      { method: "POST", headers: { "Content-Type": "image/jpeg" } },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString()) as ReportResponse,
          });
        });
      },
    );
    request.on("error", reject);
    request.end(image);
  });

const createImage = () =>
  sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: "#000000",
    },
  })
    .jpeg()
    .toBuffer();

const queryString = (latitude = "30.4") =>
  new URLSearchParams({
    lat: latitude,
    lng: "-84.3",
    capturedAt: "2026-01-01T12:00:00.000Z",
  });

function configureRoboflow(t: { after: (fn: () => void) => void }, predictions: object[]) {
  const previous = {
    apiKey: process.env.ROBOFLOW_API_KEY,
    projectId: process.env.ROBOFLOW_PROJECT_ID,
    modelVersion: process.env.ROBOFLOW_MODEL_VERSION,
  };
  process.env.ROBOFLOW_API_KEY = "test-key";
  process.env.ROBOFLOW_PROJECT_ID = "test-project";
  process.env.ROBOFLOW_MODEL_VERSION = "1";
  t.after(() => {
    if (previous.apiKey === undefined) delete process.env.ROBOFLOW_API_KEY;
    else process.env.ROBOFLOW_API_KEY = previous.apiKey;
    if (previous.projectId === undefined) delete process.env.ROBOFLOW_PROJECT_ID;
    else process.env.ROBOFLOW_PROJECT_ID = previous.projectId;
    if (previous.modelVersion === undefined) delete process.env.ROBOFLOW_MODEL_VERSION;
    else process.env.ROBOFLOW_MODEL_VERSION = previous.modelVersion;
  });
  const fetch = mock.method(globalThis, "fetch", async () =>
    Response.json({ predictions }),
  );
  t.after(() => fetch.mock.restore());
}

test("persists and attaches an image for a qualifying pothole prediction", async (t) => {
  configureRoboflow(t, [
    { class: "pothole", confidence: 0.8, x: 4, y: 4, width: 2, height: 2 },
    { class: "pothole", confidence: 0.65, x: 3, y: 3, width: 1, height: 1 },
  ]);
  const detectionId = Date.now();
  let queryCount = 0;
  const query = mock.method(pool, "query", async () => {
    queryCount += 1;
    if (queryCount === 1) {
      return {
        rows: [{ detection_id: detectionId, _id: 42, confidence: 0.8 }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  });
  t.after(() => query.mock.restore());
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    const { join } = await import("node:path");
    await rm(join(import.meta.dirname, "..", "uploads", `detection-${detectionId}.jpg`), {
      force: true,
    });
  });

  const { status, body } = await postImage(
    `${endpoint}?${queryString()}`,
    await createImage(),
  );

  assert.equal(status, 201, JSON.stringify(body));
  assert.equal(body.detected, true);
  assert.equal(body.id, detectionId);
  assert.ok(body.pothole);
  assert.equal(body.pothole.confidence, 0.8);
  assert.equal(body.image_url, `/api/uploads/detection-${detectionId}.jpg`);
  assert.equal(queryCount, 2);
});

test("does not persist when there is no qualifying pothole prediction", async (t) => {
  configureRoboflow(t, [
    { class: "pothole", confidence: 0.59, x: 4, y: 4, width: 2, height: 2 },
    { class: "speed bump", confidence: 0.9, x: 3, y: 3, width: 1, height: 1 },
  ]);
  const query = mock.method(pool, "query", async () => {
    throw new Error("No database write expected");
  });
  t.after(() => query.mock.restore());

  const { status, body } = await postImage(
    `${endpoint}?${queryString()}`,
    await createImage(),
  );

  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.detected, false);
  assert.equal(query.mock.callCount(), 0);
});

test("rejects out-of-range GPS coordinates before image analysis", async () => {
  const { status } = await postImage(
    `${endpoint}?${queryString("91")}`,
    await createImage(),
  );

  assert.equal(status, 400);
});
