import assert from "node:assert/strict";
import { once } from "node:events";
import { after, afterEach, before, mock, test } from "node:test";
import bcrypt from "bcrypt";
import express from "express";
import jwt from "jsonwebtoken";
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
const api = `http://127.0.0.1:${address.port}/api/auth`;

const PASSWORD = "correct-horse";
let passwordHash = "";

before(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
});
after(async () => {
  server.close();
  await pool.end();
});
afterEach(() => mock.restoreAll());

const account = (overrides: Partial<UserWithPassword> = {}): UserWithPassword => ({
  id: 7,
  email: "person@example.test",
  username: "person",
  role: "user",
  avatarUrl: null,
  firebaseUid: null,
  isActive: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  passwordHash,
  ...overrides,
});

const post = (path: string, body: unknown) =>
  fetch(`${api}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const login = (password = PASSWORD) =>
  post("/login", { email: "person@example.test", password });

const stubFindByEmail = (user: UserWithPassword | null) =>
  mock.method(UserModel, "findByEmail", async () => user);

const stubFindById = (user: User | null) =>
  mock.method(UserModel, "findById", async () => user);

const me = (headers: Record<string, string> = {}) => fetch(`${api}/me`, { headers });

const validSignup = {
  email: "new@example.test",
  username: "newperson",
  password: "secret12",
};

test("signup hashes the password and never returns it", async () => {
  stubFindByEmail(null);
  const create = mock.method(UserModel, "create", async () => account({ passwordHash: "x" }));

  const response = await post("/signup", validSignup);
  const text = await response.text();

  assert.equal(response.status, 201);
  const stored = create.mock.calls[0]!.arguments[0]!.passwordHash!;
  assert.notEqual(stored, validSignup.password);
  assert.ok(await bcrypt.compare(validSignup.password, stored));
  assert.ok(!text.toLowerCase().includes("password"));
});

test("signup ignores a requested role", async () => {
  stubFindByEmail(null);
  const create = mock.method(UserModel, "create", async () => account());

  await post("/signup", { ...validSignup, role: "admin" });

  assert.ok(!("role" in create.mock.calls[0]!.arguments[0]!));
});

test("signup rejects a duplicate email", async () => {
  stubFindByEmail(account());

  const response = await post("/signup", validSignup);

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { message: "Email already exists" });
});

test("signup treats a concurrent duplicate as a conflict", async () => {
  stubFindByEmail(null);
  mock.method(UserModel, "create", async () => {
    throw Object.assign(new Error("duplicate key"), { code: "23505" });
  });

  assert.equal((await post("/signup", validSignup)).status, 409);
});

for (const [field, value] of [
  ["email", "not-an-email"],
  ["username", "a"],
  ["password", "short"],
] as const) {
  test(`signup rejects an invalid ${field}`, async () => {
    assert.equal((await post("/signup", { ...validSignup, [field]: value })).status, 400);
  });
}

test("login sets a protected session cookie and hides password data", async () => {
  stubFindByEmail(account());

  const response = await login();
  const text = await response.text();
  const cookie = response.headers.get("set-cookie") ?? "";

  assert.equal(response.status, 200);
  assert.match(cookie, /^access_token=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.ok(!text.toLowerCase().includes("password"));
});

test("wrong password and unknown email give the same answer", async () => {
  stubFindByEmail(account());
  const wrongPassword = await login("wrong-password");
  const wrongPasswordBody = await wrongPassword.json();
  mock.restoreAll();

  stubFindByEmail(null);
  const unknownEmail = await login();

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.deepEqual(wrongPasswordBody, await unknownEmail.json());
  assert.equal(wrongPassword.headers.get("set-cookie"), null);
});

test("a deactivated account cannot log in", async () => {
  stubFindByEmail(account({ isActive: false }));

  assert.equal((await login()).status, 401);
});

test("a Google-only account cannot use password login", async () => {
  stubFindByEmail(account({ passwordHash: null, firebaseUid: "uid" }));

  const response = await login();

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Please login with Google" });
});

test("Google login reports when it is not configured", async () => {
  const previous = process.env.FIREBASE_APPLICATION_CREDENTIALS;
  delete process.env.FIREBASE_APPLICATION_CREDENTIALS;
  try {
    assert.equal((await post("/google", { token: "abc" })).status, 503);
  } finally {
    if (previous !== undefined) process.env.FIREBASE_APPLICATION_CREDENTIALS = previous;
  }
});

test("logout clears the session cookie", async () => {
  const response = await post("/logout", {});

  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /^access_token=;/);
});

test("/me accepts a cookie and a bearer token", async () => {
  stubFindById(account());
  const token = signAccessToken(7);

  assert.equal((await me({ cookie: `access_token=${token}` })).status, 200);
  assert.equal((await me({ authorization: `Bearer ${token}` })).status, 200);
});

test("/me rejects a request with no token", async () => {
  assert.equal((await me()).status, 401);
});

test("/me rejects invalid, expired, and wrongly signed tokens", async () => {
  const findById = stubFindById(account());
  const expired = jwt.sign({ id: 7 }, "test-secret", { expiresIn: -10 });
  const forged = jwt.sign({ id: 7 }, "another-secret");

  for (const token of ["not-a-token", expired, forged]) {
    assert.equal((await me({ authorization: `Bearer ${token}` })).status, 401);
  }
  assert.equal(findById.mock.callCount(), 0);
});

test("/me rejects a token for a deactivated or deleted user", async () => {
  const token = signAccessToken(7);

  stubFindById(account({ isActive: false }));
  assert.equal((await me({ authorization: `Bearer ${token}` })).status, 401);
  mock.restoreAll();

  stubFindById(null);
  assert.equal((await me({ authorization: `Bearer ${token}` })).status, 401);
});
