import { test } from "node:test";
import assert from "node:assert/strict";
import { usernameSchema } from "../../src/modules/users/username.ts";
import { gameSettingsInputSchema, readGameSettings, readLeaderboardSettings } from "../../src/modules/games/settings.ts";

test("username chuyển về chữ thường", () => {
  assert.equal(usernameSchema.parse("  Ha_Pham "), "ha_pham");
});

test("username sai định dạng / bị cấm bị từ chối", () => {
  for (const bad of ["ab", "toolong_username_12345", "có_dấu", "a b c", "Admin", "gamehub", "0xa401", "0x"]) {
    assert.equal(usernameSchema.safeParse(bad).success, false, bad);
  }
});

test("settings game: thiếu key → dùng mặc định, giữ key lạ", () => {
  const s = readGameSettings({ minPlaySeconds: 5, futureFlag: true });
  assert.equal(s.minPlaySeconds, 5);
  assert.equal(s.maxSessionHours, 6);
  assert.equal((s as Record<string, unknown>).futureFlag, true);
});

test("settings game hỏng → mặc định thay vì lỗi", () => {
  const s = readGameSettings({ minPlaySeconds: "abc" });
  assert.equal(s.minPlaySeconds, 0);
  assert.equal(readGameSettings(null).maxSessionHours, 6);
});

test("settings bảng xếp hạng", () => {
  assert.equal(readLeaderboardSettings({ maxScore: 4_000_000 }).maxScore, 4_000_000);
  assert.deepEqual(readLeaderboardSettings({ maxScore: -1 }), {});
});

test("sửa 1 luật không tự điền mặc định cho luật khác (tránh ghi đè khi gộp)", () => {
  const input = gameSettingsInputSchema.parse({ minPlaySeconds: 10 });
  assert.deepEqual(input, { minPlaySeconds: 10 });
  const merged = { ...{ minPlaySeconds: 5, maxSessionHours: 12 }, ...input };
  assert.equal(merged.maxSessionHours, 12);
});
