import assert from "node:assert/strict";
import { once } from "node:events";
import { after, afterEach, mock, test } from "node:test";
import express from "express";
import { pool } from "../src/db.ts";
import { errorHandler } from "../src/middleware/error.middleware.ts";
import { router } from "../src/routes/index.ts";
import { persistDetection } from "../src/services/detection-report.service.ts";

const app = express();
app.use(express.json());
app.use("/api", router);
app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("Expected a TCP address");
const baseUrl = `http://127.0.0.1:${address.port}/api/potholes`;

after(async () => {
  server.close();
  await pool.end();
});
afterEach(() => mock.restoreAll());

const HIDES_REJECTED = /review_status\s*<>\s*'rejected'/;

const captureQueries = (rows: unknown[] = []) => {
  const statements: string[] = [];
  mock.method(pool, "query", async (text: string) => {
    statements.push(text);
    return { rows, rowCount: rows.length };
  });
  return statements;
};

test("the public list hides rejected reports", async () => {
  const statements = captureQueries();

  assert.equal((await fetch(baseUrl)).status, 200);
  assert.match(statements[0]!, HIDES_REJECTED);
});

test("the public detail treats a rejected report as missing", async () => {
  const statements = captureQueries();

  assert.equal((await fetch(`${baseUrl}/5`)).status, 404);
  assert.match(statements[0]!, HIDES_REJECTED);
});

test("the nearby lookup hides rejected reports", async () => {
  const statements = captureQueries();

  assert.equal((await fetch(`${baseUrl}/nearby?latitude=30.4&longitude=-84.3`)).status, 200);
  assert.match(statements[0]!, HIDES_REJECTED);
});

test("the along-route lookup hides rejected reports", async () => {
  const statements = captureQueries();

  const response = await fetch(`${baseUrl}/along-route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ coordinates: [[-84.3, 30.4], [-84.2, 30.5]] }),
  });

  assert.equal(response.status, 200);
  assert.match(statements[0]!, HIDES_REJECTED);
});

test("a new detection sends a matched rejected report back for review", async () => {
  const statements = captureQueries([{ detection_id: 1, id: 5 }]);

  await persistDetection({
    lat: 30.4,
    lng: -84.3,
    confidence: 0.9,
    modelVersion: "v1",
    capturedAt: "2026-11-09T10:00:00Z",
  });

  assert.match(
    statements[0]!,
    /review_status\s*=\s*CASE WHEN review_status\s*=\s*'rejected' THEN 'pending'/,
  );
  assert.match(statements[0]!, /reviewed_by\s*=\s*CASE WHEN review_status\s*=\s*'rejected' THEN NULL/);
  assert.match(statements[0]!, /reviewed_at\s*=\s*CASE WHEN review_status\s*=\s*'rejected' THEN NULL/);
});
