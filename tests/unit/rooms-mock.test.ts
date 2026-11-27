import { test } from "node:test";
import assert from "node:assert/strict";
import { MockRoomError, MockRooms } from "../../src/modules/rooms/mock.ts";

const me = { id: "me", name: "sandbox_player" };
const bot = (n: number) => ({ id: `bot${n}`, name: `Bot ${n}` });
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as MockRoomError).code;
  }
  return null;
};

test("tạo → người ảo vào → bắt đầu → đi lượt luân phiên → kết thúc", () => {
  const m = new MockRooms(() => 1_000_000);
  const r = m.create(me, { maxPlayers: 2, state: { board: [] } });
  assert.match(r.code, /^[A-Z2-9]{6}$/);
  assert.equal(r.status, "WAITING");
  assert.equal(r.isHost, true);
  assert.equal(code(() => m.start("me")), "ROOM_NOT_ENOUGH_PLAYERS");

  m.join(bot(1), r.code.toLowerCase());
  assert.equal(code(() => m.join(bot(2), r.code)), "ROOM_FULL");
  assert.equal(code(() => m.start("bot1")), "NOT_ROOM_HOST");

  const s = m.start("me");
  assert.equal(s.status, "PLAYING");
  assert.equal(s.turnSeat, 0);
  assert.equal(s.myTurn, true);
  assert.equal(m.turnPlayerId(), "me");

  assert.equal(code(() => m.move("bot1", { data: 1 })), "NOT_YOUR_TURN");
  assert.equal(code(() => m.move("me", { data: 1, seq: s.seq - 1 })), "ROOM_CHANGED");
  const a = m.move("me", { data: { cell: 4 }, state: { board: [4] }, seq: s.seq });
  assert.equal(a.turnSeat, 1);
  assert.equal(a.myTurn, false);
  assert.deepEqual(a.moves.map((x) => x.data), [{ cell: 4 }]);

  const b = m.move("bot1", { data: { cell: 0 }, next: "same" });
  assert.equal(b.turnSeat, 1);
  // Game thấy nước đi của người ảo khi hỏi với seq cũ
  const seen = m.view("me", a.seq);
  assert.equal(seen.moves.length, 1);
  assert.equal(seen.moves[0]!.seat, 1);

  const f = m.move("bot1", { data: { cell: 8 }, finish: { winnerSeat: 1 } });
  assert.equal(f.status, "FINISHED");
  assert.deepEqual(f.result, { reason: "finished", winnerSeat: 1, scores: null, bySeat: 1 });
  assert.equal(code(() => m.move("me", { data: 1 })), "ROOM_NOT_PLAYING");
});

test("rời phòng: chủ phòng rời lúc chờ → đóng; còn 1 người lúc chơi → abandoned", () => {
  const m = new MockRooms(() => 0);
  const r = m.create(me, {});
  m.join(bot(1), r.code);
  assert.equal(m.leave("me").result && (m.view("me").result as { reason: string }).reason, "host_left");

  m.create(me, { maxPlayers: 3 });
  m.join(bot(1), m.room!.code);
  m.join(bot(2), m.room!.code);
  m.start("me");
  const x = m.leave("me"); // đang tới lượt me → chuyển lượt
  assert.equal(x.turnSeat, 1);
  const y = m.leave("bot1");
  assert.equal(y.status, "FINISHED");
  assert.deepEqual(y.result, { reason: "abandoned", winnerSeat: 2 });
});

test("hết giờ lượt bỏ qua người chơi; phòng 2 giờ không hoạt động thì hết hạn", () => {
  let now = 0;
  const m = new MockRooms(() => now);
  const r = m.create(me, { turnSeconds: 10 });
  m.join(bot(1), r.code);
  m.start("me");
  now = 9_000;
  assert.equal(m.tick(), false);
  now = 11_000;
  assert.equal(m.tick(), true);
  assert.equal(m.view("me").turnSeat, 1);
  now += 2 * 60 * 60 * 1000;
  assert.equal(m.tick(), true);
  assert.deepEqual(m.view("me").result, { reason: "expired" });
});

test("kiểm dữ liệu giống máy chủ", () => {
  const m = new MockRooms();
  assert.equal(code(() => m.create(me, { maxPlayers: 9 })), "VALIDATION_ERROR");
  assert.equal(code(() => m.create(me, { turnSeconds: 1 })), "VALIDATION_ERROR");
  assert.equal(code(() => m.create(me, { state: "x".repeat(40_000) })), "ROOM_STATE_TOO_LARGE");
  assert.equal(code(() => m.start("me")), "NO_ROOM");
  const r = m.create(me, {});
  assert.equal(code(() => m.join(bot(1), "AAAAAA")), "ROOM_NOT_FOUND");
  assert.equal(code(() => m.join(bot(1), "nope")), "VALIDATION_ERROR");
  m.join(bot(1), r.code);
  m.start("me");
  assert.equal(code(() => m.move("me", {})), "VALIDATION_ERROR");
  assert.equal(code(() => m.move("me", { data: "x".repeat(9000) })), "ROOM_MOVE_TOO_LARGE");
  assert.equal(code(() => m.move("me", { data: 1, next: 5 })), "NEXT_SEAT_INVALID");
  assert.equal(code(() => m.join(bot(2), r.code)), "ROOM_STARTED");
});
