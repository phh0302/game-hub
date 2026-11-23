import { test } from "node:test";
import assert from "node:assert/strict";
import { formatLog, pickRequestId, sanitize } from "../../src/lib/log.ts";

test("formatLog: 1 dòng JSON, ẩn trường nhạy cảm, cắt chuỗi dài", () => {
  const line = formatLog(
    "error",
    "request.failed",
    { route: "/api/v1/me", headers: { cookie: "gh_session=abc", authorization: "Bearer x" }, apiKey: "sk_live_1", note: "a".repeat(800) },
    new Date("2026-11-23T00:00:00Z"),
  );
  assert.ok(!line.includes("\n"));
  const o = JSON.parse(line);
  assert.equal(o.ts, "2026-11-23T00:00:00.000Z");
  assert.equal(o.level, "error");
  assert.equal(o.msg, "request.failed");
  assert.equal(o.route, "/api/v1/me");
  assert.equal(o.headers.cookie, "[redacted]");
  assert.equal(o.headers.authorization, "[redacted]");
  assert.equal(o.apiKey, "[redacted]");
  assert.ok(o.note.length <= 501);
  assert.ok(!line.includes("gh_session=abc") && !line.includes("sk_live_1"));
});

test("sanitize: Error, Date, bigint, độ sâu", () => {
  assert.deepEqual(sanitize(new TypeError("x")), { name: "TypeError", message: "x" });
  assert.equal(sanitize(new Date("2026-01-01T00:00:00Z")), "2026-01-01T00:00:00.000Z");
  assert.equal(sanitize(10n), "10");
  assert.deepEqual(sanitize({ a: { b: { c: { d: 1 } } } }), { a: { b: { c: "[…]" } } });
});

test("pickRequestId: dùng id của nền tảng nếu hợp lệ, không thì tạo mới", () => {
  assert.equal(pickRequestId("sin1::iad1::abcde-1732300000000-0123456789ab"), "sin1::iad1::abcde-1732300000000-0123456789ab");
  for (const bad of [null, undefined, "", "short", "has space here!!", "x".repeat(200), "a\nb-injected-line"]) {
    const id = pickRequestId(bad);
    assert.match(id, /^[0-9a-f]{20}$/);
  }
});
