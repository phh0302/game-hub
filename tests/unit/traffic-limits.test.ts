import { test } from "node:test";
import assert from "node:assert/strict";
import { allowsLargeBody, classifyRequest, maxBodyBytes, parseExemptIps, secondsToWindowEnd } from "../../src/lib/traffic/limits.ts";

test("classifyRequest: nhóm theo đường dẫn + phương thức", () => {
  assert.equal(classifyRequest("/api/v1/auth/nonce", "POST"), "auth");
  assert.equal(classifyRequest("/api/p1/auth/guest", "POST"), "auth");
  assert.equal(classifyRequest("/api/v1/admin/studios", "GET"), "admin");
  assert.equal(classifyRequest("/api/p1/scores", "POST"), "platform");
  assert.equal(classifyRequest("/api/s1/project", "GET"), "platform");
  assert.equal(classifyRequest("/api/v1/games/2048/sessions", "POST"), "write");
  assert.equal(classifyRequest("/api/v1/games", "GET"), "read");
});

test("classifyRequest: bỏ qua cron, preflight, trang không phải API", () => {
  assert.equal(classifyRequest("/api/cron/daily", "GET"), null);
  assert.equal(classifyRequest("/api/p1/project", "OPTIONS"), null);
  assert.equal(classifyRequest("/games/2048", "GET"), null);
});

test("allowsLargeBody chỉ cho route nhận file", () => {
  assert.equal(allowsLargeBody("/api/v1/storage/local"), true);
  assert.equal(allowsLargeBody("/api/v1/me"), false);
});

test("secondsToWindowEnd", () => {
  assert.equal(secondsToWindowEnd(60, 60_000 * 10 + 15_000), 45);
  assert.equal(secondsToWindowEnd(60, 60_000 * 10 + 59_999), 1);
});

test("parseExemptIps", () => {
  assert.deepEqual([...parseExemptIps(" 127.0.0.1, ::1 ,,unknown")], ["127.0.0.1", "::1", "unknown"]);
  assert.equal(parseExemptIps(undefined).size, 0);
});

test("maxBodyBytes: route lưu tiến trình được 256KB, route khác 64KB, kho file không giới hạn", () => {
  assert.equal(maxBodyBytes("/api/v1/me"), 64 * 1024);
  assert.equal(maxBodyBytes("/api/p1/state"), 256 * 1024);
  assert.equal(maxBodyBytes("/api/v1/games/star-jar/state"), 256 * 1024);
  assert.equal(maxBodyBytes("/api/v1/games/star-jar/state/x"), 64 * 1024);
  assert.equal(maxBodyBytes("/api/v1/storage/local"), Number.POSITIVE_INFINITY);
});
