import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPrivateAddress,
  nextRetryAt,
  normalizeWebhookUrl,
  signWebhook,
  verifyWebhookSignature,
} from "../../src/modules/platform/webhook-utils.ts";

test("normalizeWebhookUrl: chỉ https công khai", () => {
  assert.equal(normalizeWebhookUrl("https://api.mygame.io/hooks/monlabs"), "https://api.mygame.io/hooks/monlabs");
  assert.equal(normalizeWebhookUrl("http://api.mygame.io/hook"), null);
  assert.equal(normalizeWebhookUrl("https://user:pass@api.mygame.io/"), null);
  assert.equal(normalizeWebhookUrl("https://localhost/hook"), null);
  assert.equal(normalizeWebhookUrl("https://127.0.0.1/hook"), null);
  assert.equal(normalizeWebhookUrl("https://10.1.2.3/hook"), null);
  assert.equal(normalizeWebhookUrl("https://[::1]/hook"), null);
  assert.equal(normalizeWebhookUrl("https://169.254.169.254/latest"), null);
  assert.equal(normalizeWebhookUrl("không phải url"), null);
});

test("normalizeWebhookUrl: allowLocal cho test tự động", () => {
  assert.equal(normalizeWebhookUrl("http://127.0.0.1:4010/hook", true), "http://127.0.0.1:4010/hook");
});

test("isPrivateAddress", () => {
  for (const ip of ["10.0.0.1", "172.16.5.4", "192.168.1.1", "127.0.0.1", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "172.32.0.1"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test("chữ ký HMAC: đúng secret + đúng body + còn hạn mới hợp lệ", () => {
  const body = JSON.stringify({ type: "ping" });
  const now = 1_800_000_000;
  const header = signWebhook("whsec_abc", now, body);
  assert.match(header, /^t=1800000000,v1=[0-9a-f]{64}$/);
  assert.equal(verifyWebhookSignature("whsec_abc", header, body, now), true);
  assert.equal(verifyWebhookSignature("whsec_xyz", header, body, now), false);
  assert.equal(verifyWebhookSignature("whsec_abc", header, body + " ", now), false);
  assert.equal(verifyWebhookSignature("whsec_abc", header, body, now + 301), false);
  assert.equal(verifyWebhookSignature("whsec_abc", null, body, now), false);
});

test("nextRetryAt: 5 lần gửi lại rồi dừng", () => {
  const now = new Date(0);
  assert.equal(nextRetryAt(1, now)?.getTime(), 60_000);
  assert.equal(nextRetryAt(5, now)?.getTime(), 43_200_000);
  assert.equal(nextRetryAt(6, now), null);
});
