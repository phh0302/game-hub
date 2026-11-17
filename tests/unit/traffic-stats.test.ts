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
