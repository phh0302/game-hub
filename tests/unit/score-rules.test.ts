import { test } from "node:test";
import assert from "node:assert/strict";
import { checkScore } from "../../src/modules/scores/rules.ts";

const rules2048 = { minPlaySeconds: 5, maxSessionHours: 6, maxScore: 4_000_000, maxScorePerSecond: 300 };

test("ván bình thường được chấp nhận", () => {
  assert.equal(checkScore({ score: 1696, durationSeconds: 90 }, rules2048), null);
});

test("người thua nhanh với điểm thấp vẫn hợp lệ (trên ngưỡng thời gian)", () => {
  assert.equal(checkScore({ score: 120, durationSeconds: 6 }, rules2048), null);
});

test("chơi dưới thời gian tối thiểu → PLAY_TOO_SHORT", () => {
  assert.equal(checkScore({ score: 928, durationSeconds: 2 }, rules2048), "PLAY_TOO_SHORT");
});

test("bot ghi điểm quá nhanh → SCORE_TOO_FAST", () => {
  // 1696 điểm trong 5 giây = 339 điểm/giây > 300
  assert.equal(checkScore({ score: 1696, durationSeconds: 5 }, rules2048), "SCORE_TOO_FAST");
  // cùng điểm trong 10 giây = 170 điểm/giây → hợp lệ
  assert.equal(checkScore({ score: 1696, durationSeconds: 10 }, rules2048), null);
});

test("vượt điểm tối đa / dưới điểm tối thiểu → SCORE_INVALID", () => {
  assert.equal(checkScore({ score: 5_000_000, durationSeconds: 20_000 }, rules2048), "SCORE_INVALID");
  assert.equal(checkScore({ score: 3, durationSeconds: 60 }, { ...rules2048, minScore: 10 }), "SCORE_INVALID");
});

test("lượt chơi mở quá lâu → SESSION_EXPIRED", () => {
  assert.equal(checkScore({ score: 100, durationSeconds: 6 * 3600 + 1 }, rules2048), "SESSION_EXPIRED");
});

test("không cấu hình giới hạn tốc độ thì không kiểm tra", () => {
  assert.equal(checkScore({ score: 1_000_000, durationSeconds: 5 }, { minPlaySeconds: 0, maxSessionHours: 6 }), null);
});

test("bảng tính theo thời gian: thời gian game báo không được ngắn hơn thời gian server đo quá mức trừ hao", () => {
  const rules = { minPlaySeconds: 3, maxSessionHours: 2, minScore: 8000, maxScore: 3_600_000, timedScoreSlackSeconds: 5 };
  // Server đo 42 giây, game báo 40,2 giây → hợp lệ (trễ mạng)
  assert.equal(checkScore({ score: 40_200, durationSeconds: 42 }, rules), null);
  // Server đo 60 giây mà game báo 12 giây → gian lận
  assert.equal(checkScore({ score: 12_000, durationSeconds: 60 }, rules), "SCORE_INVALID");
  // Dưới thời gian tối thiểu có thể của game
  assert.equal(checkScore({ score: 5_000, durationSeconds: 5 }, rules), "SCORE_INVALID");
});
