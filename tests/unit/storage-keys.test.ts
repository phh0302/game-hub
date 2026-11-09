import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDir, imageKey, incomingZipKey, isImageKeyOf, isIncomingKeyOf, isSafeKey } from "../../src/modules/storage/keys.ts";
import { assetUrl, gameEntryUrl, isUploadKey } from "../../src/lib/assets.ts";

test("isSafeKey chặn key nguy hiểm", () => {
  assert.equal(isSafeKey("u/games/2048/1.0.0/index.html"), true);
  for (const bad of ["", "/abs", "a/../b", "a//b", "./a", "a\\b", "a/\u0000b"]) assert.equal(isSafeKey(bad), false, bad);
});

test("zip chờ xử lý chỉ thuộc về đúng user", () => {
  const key = incomingZipKey("user1", "abc");
  assert.equal(key, "u/incoming/user1/abc.zip");
  assert.equal(isIncomingKeyOf(key, "user1"), true);
  assert.equal(isIncomingKeyOf(key, "user2"), false, "user khác không dùng được");
  assert.equal(isIncomingKeyOf("u/incoming/user1/../user2/x.zip", "user1"), false);
});

test("ảnh upload chỉ thuộc về đúng user", () => {
  const key = imageKey("user1", "xyz", "png");
  assert.equal(isImageKeyOf(key, "user1"), true);
  assert.equal(isImageKeyOf(key, "user2"), false);
});

test("file upload (u/) và file đóng gói dùng base URL khác nhau", () => {
  assert.equal(isUploadKey("u/images/a.png"), true);
  assert.equal(assetUrl("u/images/a.png"), "/uploads/u/images/a.png");
  assert.equal(assetUrl("games/2048/thumbnail.svg"), "/uploads/games/2048/thumbnail.svg");
  assert.equal(gameEntryUrl({ storageKey: buildDir("my-game", "1.0.0"), entryFile: "index.html" }), "/uploads/u/games/my-game/1.0.0/index.html");
});
