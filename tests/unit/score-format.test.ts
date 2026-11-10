import { test } from "node:test";
import assert from "node:assert/strict";
import { formatScore } from "../../src/lib/score-format.ts";

test("định dạng điểm thường theo ngôn ngữ", () => {
  assert.equal(formatScore(1696, "number", "en"), "1,696");
  assert.equal(formatScore(1696, undefined, "vi"), "1.696");
});

test("định dạng thời gian mili-giây thành phút:giây,phần mười", () => {
  assert.equal(formatScore(42_740, "duration_ms", "en"), "0:42.7");
  assert.equal(formatScore(65_300, "duration_ms", "vi"), "1:05,3");
  assert.equal(formatScore(5_040, "duration_ms", "en"), "0:05.0");
});
