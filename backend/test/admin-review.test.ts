import assert from "node:assert/strict";
import { once } from "node:events";
import { after, afterEach, beforeEach, mock, test } from "node:test";
import express, { type Response } from "express";
import { pool } from "../src/db.ts";
import { errorHandler } from "../src/middleware/error.middleware.ts";
import { signAccessToken } from "../src/middleware/auth.middleware.ts";
import { ConfirmationModel, type Confirmation } from "../src/models/confirmation.model.ts";
import { PotholeReviewModel } from "../src/models/pothole-review.model.ts";
import { UserModel, type User } from "../src/models/user.model.ts";
import { router } from "../src/routes/index.ts";
import { subscribeToPotholeUpdates } from "../src/services/pothole-events.service.ts";

process.env.JWT_SECRET = "test-secret";

const app = express();
app.use(express.json());
app.use("/api", router);
app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("Expected a TCP address");
const baseUrl = `http://127.0.0.1:${address.port}/api/admin/potholes`;

after(async () => {
  server.close();
  await pool.end();
});

const ADMIN_ID = 1;
const USER_ID = 2;
const users: Record<number, Pick<User, "id" | "role" | "isActive">> = {
  [ADMIN_ID]: { id: ADMIN_ID, role: "admin", isActive: true },
  [USER_ID]: { id: USER_ID, role: "user", isActive: true },
};

const bearer = (id: number) => ({ authorization: `Bearer ${signAccessToken(id)}` });
const send = (path: string, id: number | null, init: RequestInit = {}) =>
  fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(id === null ? {} : bearer(id)),
      ...init.headers,
    },
  });
const review = (id: string, userId: number | null, decision: unknown) =>
  send(`/${id}/review`, userId, { method: "PATCH", body: JSON.stringify({ decision }) });

const reviewedPothole = { _id: 5, reviewStatus: "rejected", reviewedBy: ADMIN_ID };
type ReviewedPothole = Awaited<ReturnType<typeof PotholeReviewModel.recordDecision>>;

beforeEach(() => {
  mock.method(UserModel, "findById", async (id: number) => (users[id] as User) ?? null);
});
afterEach(() => mock.restoreAll());

for (const [method, path] of [
  ["GET", ""],
  ["GET", "/5"],
  ["PATCH", "/5/review"],
] as const) {
  test(`${method} ${path || "/"} rejects anonymous and non-admin callers`, async () => {
    const body = method === "PATCH" ? JSON.stringify({ decision: "verified" }) : null;
    const init = { method, body };

    assert.equal((await send(path, null, init)).status, 401);
    assert.equal((await send(path, USER_ID, init)).status, 403);
  });
}

test("lists pending reports by default", async () => {
  const calls: unknown[] = [];
  const queue = [{ _id: 5, stillThereCount: 2, notThereCount: 1 }];
  mock.method(PotholeReviewModel, "findQueue", async (options: unknown) => {
    calls.push(options);
    return queue as Awaited<ReturnType<typeof PotholeReviewModel.findQueue>>;
  });

  const response = await send("", ADMIN_ID);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: queue });
  assert.deepEqual(calls, [{ status: "pending", limit: 50 }]);
});

test("filters the queue by status and limit", async () => {
  const calls: unknown[] = [];
  mock.method(PotholeReviewModel, "findQueue", async (options: unknown) => {
    calls.push(options);
    return [];
  });

  const response = await send("?status=rejected&limit=10", ADMIN_ID);

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ status: "rejected", limit: 10 }]);
});

test("rejects an unknown status filter or limit", async () => {
  assert.equal((await send("?status=archived", ADMIN_ID)).status, 400);
  assert.equal((await send("?limit=0", ADMIN_ID)).status, 400);
  assert.equal((await send("?limit=201", ADMIN_ID)).status, 400);
});

test("returns a report with detections and community confirmations", async () => {
  const confirmations = [
    { potholeId: 5, userId: 2, username: "a", status: "still_there", confirmedAt: new Date(0) },
    { potholeId: 5, userId: 3, username: "b", status: "not_there", confirmedAt: new Date(0) },
  ] as Confirmation[];
  mock.method(PotholeReviewModel, "findById", async () => ({ _id: 5 }) as never);
  mock.method(PotholeReviewModel, "findDetections", async () => [{ id: 9 }] as never);
  mock.method(ConfirmationModel, "findByPothole", async () => confirmations);

  const response = await send("/5", ADMIN_ID);
  const { data } = (await response.json()) as { data: Record<string, unknown> };

  assert.equal(response.status, 200);
  assert.equal(data._id, 5);
  assert.deepEqual(data.detections, [{ id: 9 }]);
  assert.equal((data.confirmations as unknown[]).length, 2);
  assert.deepEqual(data.confirmationSummary, { still_there: 1, not_there: 1, total: 2 });
});

test("returns 404 for an unknown report", async () => {
  mock.method(PotholeReviewModel, "findById", async () => null);
  mock.method(PotholeReviewModel, "findDetections", async () => []);
  mock.method(ConfirmationModel, "findByPothole", async () => []);

  assert.equal((await send("/404", ADMIN_ID)).status, 404);
});

test("rejects an invalid report id", async () => {
  assert.equal((await send("/abc", ADMIN_ID)).status, 400);
  assert.equal((await review("abc", ADMIN_ID, "verified")).status, 400);
});

test("records the decision with the acting admin and notifies open maps", async () => {
  const calls: unknown[] = [];
  mock.method(PotholeReviewModel, "recordDecision", async (options: unknown) => {
    calls.push(options);
    return reviewedPothole as ReviewedPothole;
  });
  const events: string[] = [];
  const client = {
    write: (chunk: string) => events.push(chunk),
    on: () => client,
    writableEnded: false,
    destroyed: false,
  };
  const unsubscribe = subscribeToPotholeUpdates(client as unknown as Response);

  const response = await review("5", ADMIN_ID, "rejected");
  unsubscribe();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: reviewedPothole });
  assert.deepEqual(calls, [{ id: 5, decision: "rejected", reviewerId: ADMIN_ID }]);
  assert.ok(events.some((event) => event.includes("potholes.updated")));
});

test("rejects decisions other than verified or rejected", async () => {
  assert.equal((await review("5", ADMIN_ID, "pending")).status, 400);
  assert.equal((await review("5", ADMIN_ID, undefined)).status, 400);
});

test("returns 404 and sends no update when reviewing an unknown report", async () => {
  mock.method(PotholeReviewModel, "recordDecision", async () => null);
  const events: string[] = [];
  const client = {
    write: (chunk: string) => events.push(chunk),
    on: () => client,
    writableEnded: false,
    destroyed: false,
  };
  const unsubscribe = subscribeToPotholeUpdates(client as unknown as Response);

  const response = await review("404", ADMIN_ID, "verified");
  unsubscribe();

  assert.equal(response.status, 404);
  assert.ok(!events.some((event) => event.includes("potholes.updated")));
});
