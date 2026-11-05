import { test } from "node:test";
import assert from "node:assert/strict";
import { isBoardOpen, periodStart } from "../../src/modules/scores/period.ts";

// 2026-11-05 15:30 giờ VN = 08:30 UTC, là thứ Năm
const now = new Date("2026-11-05T08:30:00Z");

test("period all bắt đầu từ epoch", () => {
  assert.equal(periodStart("all", now).getTime(), 0);
});

test("period day = 0h hôm nay giờ VN (17:00 UTC hôm trước)", () => {
  assert.equal(periodStart("day", now).toISOString(), "2026-11-04T17:00:00.000Z");
});

test("period day: 23:30 UTC đã sang ngày mới ở VN", () => {
  const late = new Date("2026-11-05T23:30:00Z"); // 06:30 ngày 6/11 giờ VN
  assert.equal(periodStart("day", late).toISOString(), "2026-11-05T17:00:00.000Z");
});

test("period week = 0h thứ Hai tuần này giờ VN", () => {
  // Thứ Hai 2/11/2026 00:00 VN = 1/11 17:00 UTC
  assert.equal(periodStart("week", now).toISOString(), "2026-11-01T17:00:00.000Z");
});

test("period week: ngày Chủ nhật vẫn thuộc tuần bắt đầu từ thứ Hai trước đó", () => {
  const sunday = new Date("2026-11-08T10:00:00Z"); // CN 8/11 17:00 VN
  assert.equal(periodStart("week", sunday).toISOString(), "2026-11-01T17:00:00.000Z");
});

test("isBoardOpen theo startsAt / endsAt", () => {
  const start = new Date("2026-11-01T00:00:00Z");
  const end = new Date("2026-11-10T00:00:00Z");
  assert.equal(isBoardOpen({ startsAt: null, endsAt: null }, now), true);
  assert.equal(isBoardOpen({ startsAt: start, endsAt: end }, now), true);
  assert.equal(isBoardOpen({ startsAt: end, endsAt: null }, now), false, "chưa bắt đầu");
  assert.equal(isBoardOpen({ startsAt: null, endsAt: start }, now), false, "đã kết thúc");
  assert.equal(isBoardOpen({ startsAt: null, endsAt: now }, now), false, "endsAt là mốc loại trừ");
});
