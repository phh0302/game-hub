import { test } from "node:test";
import assert from "node:assert/strict";
import { pickCover } from "../../src/modules/uploads/cover.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const file = (path: string, data: Uint8Array) => ({ path, data });

test("pickCover: ưu tiên cover > og-image, gốc trước thư mục con", () => {
  const pick = pickCover([file("assets/cover.png", PNG), file("og-image.png", PNG), file("cover.jpg", JPG)]);
  assert.equal(pick?.path, "cover.jpg");
  assert.equal(pick?.contentType, "image/jpeg");
  assert.equal(pickCover([file("index.html", new Uint8Array([60])), file("og-image.png", PNG)])?.path, "og-image.png");
  assert.equal(pickCover([file("Images/Banner.PNG", PNG)])?.path, "Images/Banner.PNG");
});

test("pickCover: bỏ file giả đuôi ảnh, file quá 1MB, icon vuông không theo tên", () => {
  const fake = new TextEncoder().encode("<svg onload=alert(1)>");
  assert.equal(pickCover([file("cover.png", fake)]), null);
  const big = new Uint8Array(1024 * 1024 + 1);
  big.set(PNG);
  assert.equal(pickCover([file("cover.png", big), file("og-image.png", PNG)])?.path, "og-image.png");
  assert.equal(pickCover([file("icons/icon-512.png", PNG), file("assets/phaser.js", new Uint8Array(4))]), null);
});
