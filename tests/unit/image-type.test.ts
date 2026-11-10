import { test } from "node:test";
import assert from "node:assert/strict";
import { detectImageType } from "../../src/modules/uploads/image.ts";

test("nhận diện PNG / JPG / WEBP theo chữ ký đầu file", () => {
  assert.equal(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), "png");
  assert.equal(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "jpg");
  assert.equal(detectImageType(new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ")), "webp");
});

test("file giả dạng ảnh (HTML, SVG) bị từ chối", () => {
  assert.equal(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  assert.equal(detectImageType(new TextEncoder().encode("<!doctype html>")), null);
  assert.equal(detectImageType(new Uint8Array([])), null);
});
