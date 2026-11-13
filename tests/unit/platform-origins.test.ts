import { test } from "node:test";
import assert from "node:assert/strict";
import { isOriginAllowed, normalizeOrigin, requestOrigin } from "../../src/modules/platform/origins.ts";

test("normalizeOrigin: chuẩn hóa chữ hoa, dấu / cuối, giữ cổng", () => {
  assert.equal(normalizeOrigin("HTTPS://MyGame.io/"), "https://mygame.io");
  assert.equal(normalizeOrigin("https://play.example.com:8443"), "https://play.example.com:8443");
});

test("normalizeOrigin: cho http với localhost", () => {
  assert.equal(normalizeOrigin("http://localhost:5173"), "http://localhost:5173");
  assert.equal(normalizeOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
});

test("normalizeOrigin: từ chối http ngoài localhost, đường dẫn, giao thức lạ", () => {
  for (const bad of [
    "http://mygame.io",
    "https://mygame.io/game",
    "https://mygame.io?x=1",
    "ftp://mygame.io",
    "javascript:alert(1)",
    "https://user:pass@mygame.io",
    "mygame.io",
    "",
  ]) {
    assert.equal(normalizeOrigin(bad), null, bad);
  }
});

test("isOriginAllowed: khớp tuyệt đối, không nhận subdomain / cổng khác / null", () => {
  const allowed = ["https://mygame.io", "http://localhost:5173"];
  assert.equal(isOriginAllowed("https://mygame.io", allowed), true);
  assert.equal(isOriginAllowed("https://MYGAME.io", allowed), true);
  assert.equal(isOriginAllowed("http://localhost:5173", allowed), true);
  assert.equal(isOriginAllowed("https://evil.mygame.io", allowed), false);
  assert.equal(isOriginAllowed("https://mygame.io.evil.com", allowed), false);
  assert.equal(isOriginAllowed("http://localhost:3000", allowed), false);
  assert.equal(isOriginAllowed("null", allowed), false);
  assert.equal(isOriginAllowed(null, allowed), false);
});

test("requestOrigin: ưu tiên header Origin; GET cùng domain (không có Origin) dùng Sec-Fetch-Site", () => {
  const url = "https://play.monlabs.fun/api/p1/project";
  assert.equal(requestOrigin({ origin: "https://mygame.io", secFetchSite: "cross-site" }, url), "https://mygame.io");
  assert.equal(requestOrigin({ origin: null, secFetchSite: "same-origin" }, url), "https://play.monlabs.fun");
  assert.equal(requestOrigin({ origin: null, secFetchSite: "cross-site" }, url), null);
  assert.equal(requestOrigin({ origin: null, secFetchSite: null }, url), null);
  assert.equal(requestOrigin({ origin: "null", secFetchSite: "same-site" }, url), null);
});
