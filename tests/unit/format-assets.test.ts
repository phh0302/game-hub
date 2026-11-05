import { test } from "node:test";
import assert from "node:assert/strict";
import { displayName, shortAddress, toNumber } from "../../src/lib/format.ts";
import { assetUrl, gameEntryUrl } from "../../src/lib/assets.ts";

test("shortAddress rút gọn địa chỉ ví", () => {
  assert.equal(shortAddress("0xa4014a8721bbc61c1e0b8871284c4d19c7d0f4fa"), "0xa401…f4fa");
  assert.equal(shortAddress("0x12"), "0x12");
});

test("displayName ưu tiên username → ví → Player-xxxx", () => {
  assert.equal(displayName({ id: "abc123", username: "ha_pham", walletAddress: "0xa4014a8721bbc61c1e0b8871284c4d19c7d0f4fa" }), "ha_pham");
  assert.equal(displayName({ id: "abc123", username: null, walletAddress: "0xa4014a8721bbc61c1e0b8871284c4d19c7d0f4fa" }), "0xa401…f4fa");
  assert.equal(displayName({ id: "abc123", username: null, walletAddress: null }), "Player-c123");
});

test("toNumber đổi BigInt từ DB", () => {
  assert.equal(toNumber(4_000_000n), 4_000_000);
  assert.equal(toNumber(12), 12);
});

test("assetUrl ghép key với thư mục mặc định /uploads", () => {
  assert.equal(assetUrl("games/2048/thumbnail.svg"), "/uploads/games/2048/thumbnail.svg");
  assert.equal(assetUrl("/games/x.png"), "/uploads/games/x.png");
  assert.equal(assetUrl("https://cdn.example.com/a.png"), "https://cdn.example.com/a.png");
  assert.equal(assetUrl(null), null);
});

test("gameEntryUrl ghép thư mục build + file chạy", () => {
  assert.equal(
    gameEntryUrl({ storageKey: "games/2048/1.0.0/", entryFile: "index.html" }),
    "/uploads/games/2048/1.0.0/index.html",
  );
});
