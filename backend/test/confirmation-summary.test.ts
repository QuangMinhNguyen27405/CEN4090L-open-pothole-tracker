import assert from "node:assert/strict";
import { once } from "node:events";
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
const baseUrl = `http://127.0.0.1:${address.port}/api/potholes`;

after(async () => {
  server.close();
  await pool.end();
});

const USER_ID = 2;

const captureSummary = (rows: unknown[]) => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  mock.method(pool, "query", async (text: string, values: unknown[]) => {
    calls.push({ text, values });
    return { rows, rowCount: rows.length };
  });
  return calls;
};

beforeEach(() => {
  mock.method(UserModel, "findById", async (id: number) =>
    id === USER_ID ? ({ id, role: "user", isActive: true } as User) : null,
  );
});
afterEach(() => mock.restoreAll());

test("returns public counts to an anonymous visitor", async () => {
  const summary = { still_there: 3, not_there: 1, my_response: null };
  const calls = captureSummary([summary]);

  const response = await fetch(`${baseUrl}/5/confirmations`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), summary);
  assert.deepEqual(calls[0]!.values, [5, null]);
});

test("includes the signed-in caller's own response", async () => {
  const summary = { still_there: 3, not_there: 1, my_response: false };
  const calls = captureSummary([summary]);

  const response = await fetch(`${baseUrl}/5/confirmations`, {
    headers: { authorization: `Bearer ${signAccessToken(USER_ID)}` },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), summary);
  assert.deepEqual(calls[0]!.values, [5, USER_ID]);
});

test("treats an invalid token as an anonymous visitor", async () => {
  const calls = captureSummary([{ still_there: 0, not_there: 0, my_response: null }]);

  const response = await fetch(`${baseUrl}/5/confirmations`, {
    headers: { authorization: "Bearer not-a-token" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls[0]!.values, [5, null]);
});

test("does not expose confirmations for rejected reports", async () => {
  const calls = captureSummary([]);

  const response = await fetch(`${baseUrl}/5/confirmations`);

  assert.equal(response.status, 404);
  assert.match(calls[0]!.text, /review_status\s*<>\s*'rejected'/);
});

test("rejects an invalid report id", async () => {
  assert.equal((await fetch(`${baseUrl}/abc/confirmations`)).status, 400);
});
