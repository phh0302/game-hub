import { test } from "node:test";
import assert from "node:assert/strict";
import {
  latencyBucket,
  normalizeRoute,
  parseSampleRate,
  percentileFromHistogram,
  statusClass,
} from "../../src/lib/traffic/stats-keys.ts";

test("normalizeRoute gom id / slug", () => {
  assert.equal(normalizeRoute("/api/v1/games/2048/sessions"), "/api/v1/games/:slug/sessions");
  assert.equal(normalizeRoute("/api/v1/games/caro/rooms/ABC234/move"), "/api/v1/games/:slug/rooms/:code/move");
  assert.equal(normalizeRoute("/api/v1/games/caro/rooms"), "/api/v1/games/:slug/rooms");
  assert.equal(normalizeRoute("/api/v1/developer/games/cmweot7wh0001jy08lmypwoa6/keys"), "/api/v1/developer/games/:id/keys");
  assert.equal(normalizeRoute("/api/s1/players/cmabcdefghijklmnopqrstu/ban"), "/api/s1/players/:id/ban");
  assert.equal(normalizeRoute("/api/v1/me"), "/api/v1/me");
});

test("latencyBucket + percentile", () => {
  assert.equal(latencyBucket(30), "50");
  assert.equal(latencyBucket(150), "200");
  assert.equal(latencyBucket(9000), "inf");
  const hist = { "50": 50, "100": 30, "200": 15, "500": 5 };
  assert.equal(percentileFromHistogram(hist, 0.5), 50);
  assert.equal(percentileFromHistogram(hist, 0.95), 200);
  assert.equal(percentileFromHistogram({}, 0.5), null);
});

test("statusClass + parseSampleRate", () => {
  assert.equal(statusClass(204), "2xx");
  assert.equal(statusClass(429), "4xx");
  assert.equal(statusClass(503), "5xx");
  assert.equal(parseSampleRate("1"), 1);
  assert.equal(parseSampleRate("0"), 0.2);
  assert.equal(parseSampleRate(undefined), 0.2);
  assert.equal(parseSampleRate("0.05"), 0.05);
});

test("slowRoutes: độ trễ trung bình theo route, bỏ route ít mẫu, kèm lỗi 5xx", async () => {
  const { slowRoutes } = await import("../../src/lib/traffic/stats-keys.ts");
  const rows = slowRoutes([
    { "rt:/api/v1/a": 300, "rc:/api/v1/a": 3, "rt:/api/v1/b": 5000, "rc:/api/v1/b": 2, "rt:/api/v1/c": 100, "rc:/api/v1/c": 4 },
    { "rt:/api/v1/a": 900, "rc:/api/v1/a": 1, "re:/api/v1/a": 1, req: 10 },
  ]);
  assert.deepEqual(rows, [
    { name: "/api/v1/a", avgMs: 300, samples: 4, errors: 1 },
    { name: "/api/v1/c", avgMs: 25, samples: 4, errors: 0 },
  ]);
});
