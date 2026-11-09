import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { UserModel, type UserWithPassword } from "../src/models/user.model.ts";
import { grantAdmin } from "../scripts/make-admin.ts";

const account = (overrides: Partial<UserWithPassword>): UserWithPassword => ({
  id: 7,
  email: "person@example.test",
  username: "person",
  role: "user",
  avatarUrl: null,
  firebaseUid: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  passwordHash: null,
  ...overrides,
});

const stubUser = (user: UserWithPassword | null) => {
  mock.method(UserModel, "findByEmail", async () => user);
  return mock.method(UserModel, "setRole", async () => {});
};

afterEach(() => mock.restoreAll());

test("promotes an active user", async () => {
  const setRole = stubUser(account({}));

  assert.equal(await grantAdmin("person@example.test"), "granted");
  assert.deepEqual(setRole.mock.calls[0]?.arguments, [7, "admin"]);
});

test("leaves an existing admin unchanged", async () => {
  const setRole = stubUser(account({ role: "admin" }));

  assert.equal(await grantAdmin("person@example.test"), "already_admin");
  assert.equal(setRole.mock.callCount(), 0);
});

test("reports an unknown email", async () => {
  const setRole = stubUser(null);

  assert.equal(await grantAdmin("nobody@example.test"), "not_found");
  assert.equal(setRole.mock.callCount(), 0);
});

test("refuses a deactivated account", async () => {
  const setRole = stubUser(account({ isActive: false }));

  assert.equal(await grantAdmin("person@example.test"), "inactive");
  assert.equal(setRole.mock.callCount(), 0);
});
