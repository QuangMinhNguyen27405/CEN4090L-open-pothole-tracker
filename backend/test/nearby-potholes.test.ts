import assert from "node:assert/strict";
import { once } from "node:events";
import { after, mock, test } from "node:test";
import express from "express";
import { pool } from "../src/db.ts";
import { errorHandler } from "../src/middleware/error.middleware.ts";
import { NearbyPotholesModel } from "../src/models/nearby-potholes.model.ts";
import { router } from "../src/routes/index.ts";

const app = express();
app.use("/api", router);
app.use(errorHandler);

const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("Expected a TCP address");
const baseUrl = `http://127.0.0.1:${address.port}/api/potholes/nearby`;
type NearbyOptions = Parameters<typeof NearbyPotholesModel.findNearby>[0];

after(() => server.close());

test("returns nearby potholes and passes validated defaults to the model", async (t) => {
  const calls: unknown[] = [];
  const potholes = [{ _id: 7, latitude: 30.4, longitude: -84.3, distanceMeters: 12 }];
  mock.method(NearbyPotholesModel, "findNearby", async (options: NearbyOptions) => {
    calls.push(options);
    return potholes as Awaited<ReturnType<typeof NearbyPotholesModel.findNearby>>;
  });
  t.after(() => mock.restoreAll());

  const response = await fetch(`${baseUrl}?latitude=30.4&longitude=-84.3`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), potholes);
  assert.deepEqual(calls, [{ latitude: 30.4, longitude: -84.3, radiusMeters: 250, limit: 50 }]);
});

test("rejects missing, blank, and out-of-range query values", async () => {
  const invalidQueries = [
    "longitude=-84.3",
    "latitude=&longitude=-84.3",
    "latitude=91&longitude=-84.3",
    "latitude=30.4&longitude=-181",
    "latitude=30.4&longitude=-84.3&radiusMeters=0",
    "latitude=30.4&longitude=-84.3&radiusMeters=5001",
    "latitude=30.4&longitude=-84.3&limit=1.5",
    "latitude=30.4&longitude=-84.3&limit=101",
  ];

  for (const query of invalidQueries) {
    const response = await fetch(`${baseUrl}?${query}`);
    assert.equal(response.status, 400, query);
  }
});

test("accepts explicit radius and result limit", async (t) => {
  const calls: unknown[] = [];
  mock.method(NearbyPotholesModel, "findNearby", async (options: NearbyOptions) => {
    calls.push(options);
    return [];
  });
  t.after(() => mock.restoreAll());

  const response = await fetch(
    `${baseUrl}?latitude=30.4&longitude=-84.3&radiusMeters=1000&limit=10`,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
  assert.deepEqual(calls, [{ latitude: 30.4, longitude: -84.3, radiusMeters: 1000, limit: 10 }]);
});

test("passes longitude before latitude to the spatial query", async (t) => {
  const query = mock.method(pool, "query", async () => ({ rows: [] }));
  t.after(() => query.mock.restore());

  await NearbyPotholesModel.findNearby({
    latitude: 30.4,
    longitude: -84.3,
    radiusMeters: 250,
    limit: 50,
  });

  assert.match(String(query.mock.calls[0]?.arguments[0]), /ST_DWithin/);
  assert.deepEqual(query.mock.calls[0]?.arguments[1], [-84.3, 30.4, 250, 50]);
});
