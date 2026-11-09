import assert from "node:assert/strict";
import { test } from "node:test";
import { AxiosError, type AxiosResponse } from "axios";
import { getApiErrorMessage } from "../src/utils/apiError.ts";

const failedWith = (data: unknown) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    data,
  } as AxiosResponse);

test("uses the message field from API failures", () => {
  const error = failedWith({ message: "Invalid email or password" });
  assert.equal(getApiErrorMessage(error, "Login failed"), "Invalid email or password");
});

test("uses the first validation issue", () => {
  const error = failedWith({ error: [{ message: "Invalid email address" }, { message: "Other" }] });
  assert.equal(getApiErrorMessage(error, "Login failed"), "Invalid email address");
});

test("uses a plain error string", () => {
  assert.equal(getApiErrorMessage(failedWith({ error: "Not found" }), "Failed"), "Not found");
});

test("falls back when the response has no usable message", () => {
  assert.equal(getApiErrorMessage(failedWith({}), "Login failed"), "Login failed");
  assert.equal(getApiErrorMessage(failedWith({ error: [] }), "Login failed"), "Login failed");
  assert.equal(getApiErrorMessage(failedWith("<html>"), "Login failed"), "Login failed");
});

test("falls back when the request never reached the API", () => {
  const error = new AxiosError("Network Error", "ERR_NETWORK");
  assert.equal(getApiErrorMessage(error, "Login failed"), "Login failed");
});

test("uses the message of non-API errors", () => {
  assert.equal(getApiErrorMessage(new Error("Popup closed"), "Login failed"), "Popup closed");
});
