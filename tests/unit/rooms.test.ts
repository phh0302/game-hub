import { test } from "node:test";
import assert from "node:assert/strict";
import { freeSeat, isRoomCode, jsonBytes, newRoomCode, nextSeat, resolveNext, skipExpiredTurns } from "../../src/modules/rooms/rules.ts";

test("mã phòng: 6 ký tự dễ đọc", () => {
  const c = newRoomCode();
  assert.ok(isRoomCode(c), c);
  for (const bad of ["abc123", "ABC12", "ABCDEFG", "ABCD0O", 123456]) assert.equal(isRoomCode(bad), false);
});

test("ghế trống, lượt kế tiếp vòng tròn, bỏ qua người đã rời", () => {
  assert.equal(freeSeat([0, 1], 4), 2);
  assert.equal(freeSeat([1], 2), 0);
  assert.equal(freeSeat([0, 1], 2), null);
  assert.equal(nextSeat([0, 1, 2], 0), 1);
  assert.equal(nextSeat([0, 1, 2], 2), 0);
  assert.equal(nextSeat([0, 2], 1), 2); // ghế 1 đã rời
  assert.equal(nextSeat([], 0), null);
  assert.equal(resolveNext([0, 1], 0, "same"), 0);
  assert.equal(resolveNext([0, 1], 0, 1), 1);
  assert.equal(resolveNext([0, 1], 1, undefined), 0);
  assert.throws(() => resolveNext([0, 1], 0, 5), /NEXT_SEAT_INVALID/);
});

test("hết giờ lượt: chuyển lượt, nhiều lượt nếu quá lâu, chưa hết giờ thì giữ", () => {
  const now = new Date("2026-11-26T10:00:00Z");
  assert.equal(skipExpiredTurns([0, 1], 0, new Date(now.getTime() + 1000), 30, now), null);
  assert.equal(skipExpiredTurns([0, 1], 0, new Date(now.getTime() - 1000), null, now), null);
  const one = skipExpiredTurns([0, 1], 0, new Date(now.getTime() - 1000), 30, now)!;
  assert.equal(one.turnSeat, 1);
  assert.equal(one.skipped, 1);
  assert.ok(one.deadline > now);
  const many = skipExpiredTurns([0, 1, 2], 0, new Date(now.getTime() - 65_000), 30, now)!;
  assert.equal(many.skipped, 3);
  assert.equal(many.turnSeat, 0);
});

test("đo kích thước JSON theo byte", () => {
  assert.equal(jsonBytes({ a: "ệ" }), 11); // {"a":"ệ"} = 8 ký tự ASCII + 3 byte
});
