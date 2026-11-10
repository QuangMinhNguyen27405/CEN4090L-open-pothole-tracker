import assert from "node:assert/strict";
import { once } from "node:events";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import bcrypt from "bcrypt";
import express from "express";
import { pool } from "../src/db.ts";
import { errorHandler } from "../src/middleware/error.middleware.ts";
import { signAccessToken } from "../src/middleware/auth.middleware.ts";
import { UserModel, type User, type UserWithPassword } from "../src/models/user.model.ts";
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
const api = `http://127.0.0.1:${address.port}/api/users`;

const ADMIN_ID = 1;
const SELF_ID = 2;
const OTHER_ID = 3;
const PASSWORD = "current-pass";
let passwordHash = "";

const user = (id: number, overrides: Partial<User> = {}): User => ({
  id,
  email: `user${id}@example.test`,
  username: `user${id}`,
  role: id === ADMIN_ID ? "admin" : "user",
  avatarUrl: null,
  firebaseUid: null,
  isActive: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...overrides,
});

const withPassword = (overrides: Partial<UserWithPassword> = {}): UserWithPassword => ({
  ...user(SELF_ID),
  passwordHash,
  ...overrides,
});

before(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
});
beforeEach(() => {
  mock.method(UserModel, "findById", async (id: number) => user(id));
});
afterEach(() => mock.restoreAll());
after(async () => {
  server.close();
  await pool.end();
});

const send = (method: string, path: string, callerId: number | null, body?: unknown) =>
  fetch(`${api}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(callerId === null ? {} : { authorization: `Bearer ${signAccessToken(callerId)}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

for (const [method, path, body] of [
  ["GET", "/me", undefined],
  ["PUT", "/me", { username: "changed" }],
  ["PUT", "/me/password", { currentPassword: PASSWORD, newPassword: "new-password" }],
  ["GET", "/me/stats", undefined],
  ["PUT", "/3", { username: "changed" }],
  ["DELETE", "/3", undefined],
] as const) {
  test(`${method} ${path} requires sign-in`, async () => {
    assert.equal((await send(method, path, null, body)).status, 401);
  });
}

test("a user can update their own record", async () => {
  const update = mock.method(UserModel, "update", async () => user(SELF_ID));

  assert.equal((await send("PUT", `/${SELF_ID}`, SELF_ID, { username: "changed" })).status, 200);
  assert.equal(update.mock.calls[0]!.arguments[0], SELF_ID);
});

test("a user cannot update another user", async () => {
  const update = mock.method(UserModel, "update", async () => user(OTHER_ID));

  assert.equal((await send("PUT", `/${OTHER_ID}`, SELF_ID, { username: "changed" })).status, 403);
  assert.equal(update.mock.callCount(), 0);
});

test("an admin can update another user", async () => {
  mock.method(UserModel, "update", async () => user(OTHER_ID));

  assert.equal((await send("PUT", `/${OTHER_ID}`, ADMIN_ID, { username: "changed" })).status, 200);
});

test("a user cannot delete another user", async () => {
  const deactivate = mock.method(UserModel, "deactivate", async () => true);

  assert.equal((await send("DELETE", `/${OTHER_ID}`, SELF_ID)).status, 403);
  assert.equal(deactivate.mock.callCount(), 0);
});

test("a user can delete their own account and an admin can delete another", async () => {
  const deactivate = mock.method(UserModel, "deactivate", async () => true);

  assert.equal((await send("DELETE", `/${SELF_ID}`, SELF_ID)).status, 200);
  assert.equal((await send("DELETE", `/${OTHER_ID}`, ADMIN_ID)).status, 200);
  assert.deepEqual(deactivate.mock.calls.map((call) => call.arguments[0]), [SELF_ID, OTHER_ID]);
});

test("no profile update can change a role", async () => {
  const update = mock.method(UserModel, "update", async () => user(SELF_ID));
  const setRole = mock.method(UserModel, "setRole", async () => {});
  const body = { username: "changed", role: "admin" };

  await send("PUT", "/me", SELF_ID, body);
  await send("PUT", `/${SELF_ID}`, SELF_ID, body);

  assert.equal(update.mock.callCount(), 2);
  for (const call of update.mock.calls) {
    assert.ok(!("role" in call.arguments[1]!));
  }
  assert.equal(setRole.mock.callCount(), 0);
});

test("a user cannot take an email already in use", async () => {
  mock.method(UserModel, "findByEmail", async () => ({ ...withPassword(), id: OTHER_ID }));
  const update = mock.method(UserModel, "update", async () => user(SELF_ID));

  const response = await send("PUT", "/me", SELF_ID, { email: "taken@example.test" });

  assert.equal(response.status, 400);
  assert.equal(update.mock.callCount(), 0);
});

test("changing a password requires the current one and stores a new hash", async () => {
  mock.method(UserModel, "findByIdWithPassword", async () => withPassword());
  const setPassword = mock.method(UserModel, "setPassword", async () => {});

  const wrong = await send("PUT", "/me/password", SELF_ID, {
    currentPassword: "wrong-password",
    newPassword: "new-password",
  });
  assert.equal(wrong.status, 400);
  assert.equal(setPassword.mock.callCount(), 0);

  const right = await send("PUT", "/me/password", SELF_ID, {
    currentPassword: PASSWORD,
    newPassword: "new-password",
  });
  assert.equal(right.status, 200);
  const [id, stored] = setPassword.mock.calls[0]!.arguments;
  assert.equal(id, SELF_ID);
  assert.notEqual(stored, "new-password");
  assert.ok(await bcrypt.compare("new-password", stored!));
});

test("a Google account cannot change a password", async () => {
  mock.method(UserModel, "findByIdWithPassword", async () => withPassword({ passwordHash: null }));

  const response = await send("PUT", "/me/password", SELF_ID, {
    currentPassword: "any-password",
    newPassword: "new-password",
  });

  assert.equal(response.status, 400);
});

test("a public profile hides the email address", async () => {
  const response = await send("GET", `/${OTHER_ID}`, null);
  const { data } = (await response.json()) as { data: Record<string, unknown> };

  assert.equal(response.status, 200);
  assert.equal(data.username, `user${OTHER_ID}`);
  assert.ok(!("email" in data));
});

test("a deactivated user has no public profile", async () => {
  mock.restoreAll();
  mock.method(UserModel, "findById", async (id: number) => user(id, { isActive: false }));

  assert.equal((await send("GET", `/${OTHER_ID}`, null)).status, 404);
});

test("rejects an invalid user id", async () => {
  assert.equal((await send("GET", "/abc", null)).status, 400);
  assert.equal((await send("DELETE", "/abc", ADMIN_ID)).status, 400);
});
