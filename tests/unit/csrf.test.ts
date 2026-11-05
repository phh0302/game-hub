import { test } from "node:test";
import assert from "node:assert/strict";
import { isCrossSiteWrite } from "../../src/modules/auth/csrf.ts";

const base = { host: "gamehub.vn", forwardedHost: null };

test("GET không bao giờ bị chặn", () => {
  assert.equal(isCrossSiteWrite({ ...base, method: "GET", origin: "https://evil.com" }), false);
});

test("POST cùng origin được cho qua", () => {
  assert.equal(isCrossSiteWrite({ ...base, method: "POST", origin: "https://gamehub.vn" }), false);
});

test("POST từ web khác bị chặn", () => {
  assert.equal(isCrossSiteWrite({ ...base, method: "POST", origin: "https://evil.com" }), true);
  assert.equal(isCrossSiteWrite({ ...base, method: "PATCH", origin: "https://gamehub.vn.evil.com" }), true);
});

test("Origin null (game sandbox, file://) bị chặn", () => {
  assert.equal(isCrossSiteWrite({ ...base, method: "POST", origin: "null" }), true);
});

test("không có Origin (curl, server) thì cho qua", () => {
  assert.equal(isCrossSiteWrite({ ...base, method: "DELETE", origin: null }), false);
});

test("chạy sau proxy: chấp nhận x-forwarded-host", () => {
  assert.equal(
    isCrossSiteWrite({ method: "POST", origin: "https://gamehub.vn", host: "127.0.0.1:3000", forwardedHost: "gamehub.vn" }),
    false,
  );
});

test("localhost dev có cổng", () => {
  assert.equal(isCrossSiteWrite({ method: "POST", origin: "http://localhost:3000", host: "localhost:3000" }), false);
  assert.equal(isCrossSiteWrite({ method: "POST", origin: "http://localhost:4000", host: "localhost:3000" }), true);
});
