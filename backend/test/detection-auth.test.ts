import assert from "node:assert/strict";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { after, afterEach, beforeEach, mock, test } from "node:test";
import express from "express";
import { pool } from "../src/db.ts";
import { errorHandler } from "../src/middleware/error.middleware.ts";
import { signAccessToken } from "../src/middleware/auth.middleware.ts";
import { UserModel, type User } from "../src/models/user.model.ts";
import { router } from "../src/routes/index.ts";

process.env.JWT_SECRET = "test-secret";

const app = express();
app.use(express.json());
app.use("/api", router);
app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("Expected a TCP address");
const api = `http://127.0.0.1:${address.port}/api`;

after(async () => {
  server.close();
  await pool.end();
});

const OWNER_ID = 2;
const OTHER_ID = 3;
const ADMIN_ID = 1;
const users: Record<number, Pick<User, "id" | "role" | "isActive">> = {
  [ADMIN_ID]: { id: ADMIN_ID, role: "admin", isActive: true },
  [OWNER_ID]: { id: OWNER_ID, role: "user", isActive: true },
  [OTHER_ID]: { id: OTHER_ID, role: "user", isActive: true },
};
const DETECTION_ID = 910001;
const JPEG_BODY = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const detectionBody = {
  lat: 30.4,
  lng: -84.3,
  confidence: 0.8,
  modelVersion: "v1",
  capturedAt: "2026-11-09T10:00:00Z",
};

const authHeader = (id: number) => ({ authorization: `Bearer ${signAccessToken(id)}` });

const mockOwnedDetection = (ownerId: number | null | undefined) => {
  const statements: string[] = [];
  mock.method(pool, "query", async (text: string) => {
    statements.push(text);
    if (text.includes("SELECT user_id FROM detections")) {
      return ownerId === undefined
        ? { rows: [], rowCount: 0 }
        : { rows: [{ user_id: ownerId }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
  return statements;
};

const uploadImage = (userId: number) =>
  fetch(`${api}/detections/${DETECTION_ID}/image`, {
    method: "PUT",
    headers: { "content-type": "image/jpeg", ...authHeader(userId) },
    body: JPEG_BODY,
  });

beforeEach(() => {
  mock.method(UserModel, "findById", async (id: number) => (users[id] as User) ?? null);
});
afterEach(async () => {
  mock.restoreAll();
  await rm(join(import.meta.dirname, "..", "uploads", `detection-${DETECTION_ID}.jpg`), {
    force: true,
  });
});

for (const [method, path, contentType] of [
  ["POST", "/detections", "application/json"],
  ["PUT", "/detections/1/image", "image/jpeg"],
  ["POST", "/detections/analyze", "image/jpeg"],
  ["POST", "/detections/report?lat=30.4&lng=-84.3&capturedAt=2026-11-09T10:00:00Z", "image/jpeg"],
] as const) {
  test(`${method} ${path.split("?")[0]} requires sign-in`, async () => {
    const query = mock.method(pool, "query", async () => ({ rows: [], rowCount: 0 }));

    const response = await fetch(`${api}${path}`, {
      method,
      headers: { "content-type": contentType },
      body: contentType === "application/json" ? JSON.stringify(detectionBody) : JPEG_BODY,
    });

    assert.equal(response.status, 401);
    assert.equal(query.mock.callCount(), 0);
  });
}

test("records the signed-in user on a new detection", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  mock.method(pool, "query", async (text: string, values: unknown[]) => {
    calls.push({ text, values });
    return { rows: [{ detection_id: 1, id: 5 }], rowCount: 1 };
  });

  const response = await fetch(`${api}/detections`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeader(OWNER_ID) },
    body: JSON.stringify(detectionBody),
  });

  assert.equal(response.status, 201);
  assert.match(calls[0]!.text, /INSERT INTO potholes \(location, confidence, reported_by\)/);
  assert.match(calls[0]!.text, /captured_at, user_id\)/);
  assert.equal(calls[0]!.values.at(-1), OWNER_ID);
});

test("lets the owner attach an image", async () => {
  mockOwnedDetection(OWNER_ID);

  assert.equal((await uploadImage(OWNER_ID)).status, 200);
});

test("lets an admin attach an image to another user's detection", async () => {
  mockOwnedDetection(OWNER_ID);

  assert.equal((await uploadImage(ADMIN_ID)).status, 200);
});

test("refuses an image from a different user", async () => {
  const statements = mockOwnedDetection(OWNER_ID);

  assert.equal((await uploadImage(OTHER_ID)).status, 403);
  assert.equal(statements.length, 1);
});

test("refuses a regular user on a detection with no owner", async () => {
  mockOwnedDetection(null);

  assert.equal((await uploadImage(OTHER_ID)).status, 403);
});

test("returns 404 for an image on an unknown detection", async () => {
  mockOwnedDetection(undefined);

  assert.equal((await uploadImage(OWNER_ID)).status, 404);
});

test("profile statistics count the user's own detections", async () => {
  const statements: string[] = [];
  mock.method(pool, "query", async (text: string) => {
    statements.push(text);
    return {
      rows: [{ potholesDetected: 2, totalDetections: 5, confirmations: 1 }],
      rowCount: 1,
    };
  });

  const response = await fetch(`${api}/users/me/stats`, { headers: authHeader(OWNER_ID) });
  const { data } = (await response.json()) as { data: Record<string, number> };

  assert.equal(response.status, 200);
  assert.deepEqual(data, { potholesDetected: 2, totalDetections: 5, confirmations: 1 });
  assert.match(statements[0]!, /count\(\*\) FROM detections WHERE user_id = \$1/);
});
