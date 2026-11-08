import assert from "node:assert/strict";
import { once } from "node:events";
import { after, test } from "node:test";
import express from "express";
import { eventsRouter } from "../src/routes/events.routes.ts";
import { publishPotholeUpdate } from "../src/services/pothole-events.service.ts";

const app = express();
app.use("/api/events", eventsRouter);

const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("Expected a TCP address");
const endpoint = `http://127.0.0.1:${address.port}/api/events`;

after(() => server.close());

test("sends a pothole update to connected event-stream clients", async () => {
  const abort = new AbortController();
  const response = await fetch(endpoint, { signal: abort.signal });
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  assert.ok(response.body);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  try {
    const connected = await reader.read();
    assert.match(decoder.decode(connected.value), /: connected/);

    publishPotholeUpdate();

    const update = await reader.read();
    assert.match(
      decoder.decode(update.value),
      /data: \{"type":"potholes\.updated"\}/,
    );
  } finally {
    abort.abort();
    await reader.cancel().catch(() => undefined);
  }
});
