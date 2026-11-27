// Phòng chơi giả lập cho Sandbox: chạy trong trình duyệt, cùng luật với máy chủ (rules.ts) và trả đúng dạng dữ liệu
// như API thật (RoomDto) – để developer thử GameHub.rooms trên máy mà không cần upload game lên hub.
// Hàm thuần, không import alias → unit test được.
import {
  freeSeat,
  isRoomCode,
  jsonBytes,
  MAX_MOVE_BYTES,
  MAX_PLAYERS,
  MAX_STATE_BYTES,
  MIN_PLAYERS,
  newRoomCode,
  nextSeat,
  resolveNext,
  ROOM_TTL_MS,
  skipExpiredTurns,
} from "./rules.ts";

export type MockRoomStatus = "WAITING" | "PLAYING" | "FINISHED";

export type MockRoomView = {
  code: string;
  status: MockRoomStatus;
  seq: number;
  maxPlayers: number;
  turnSeconds: number | null;
  turnSeat: number | null;
  turnDeadline: string | null;
  mySeat: number | null;
  myTurn: boolean;
  isHost: boolean;
  state: unknown;
  result: unknown;
  players: { seat: number; name: string; host: boolean; left: boolean }[];
  moves: { seq: number; seat: number; data: unknown; at: string }[];
};

type Player = { id: string; name: string; seat: number; left: boolean };
type Room = {
  code: string;
  hostId: string;
  status: MockRoomStatus;
  seq: number;
  maxPlayers: number;
  turnSeconds: number | null;
  turnSeat: number | null;
  turnDeadline: number | null;
  expiresAt: number;
  state: unknown;
  result: unknown;
  players: Player[];
  moves: { seq: number; seat: number; data: unknown; at: number }[];
};

export class MockRoomError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

const fail = (code: string): never => {
  throw new MockRoomError(code);
};

function intIn(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

/** Một phòng tại một thời điểm (đủ cho thử trên máy); now() tiêm được để test hết giờ lượt / hết hạn */
export class MockRooms {
  room: Room | null = null;
  private now: () => number;
  private random?: (n: number) => Uint8Array;

  constructor(now: () => number = () => Date.now(), random?: (n: number) => Uint8Array) {
    this.now = now;
    this.random = random;
  }

  private active(): number[] {
    return this.room ? this.room.players.filter((p) => !p.left).map((p) => p.seat) : [];
  }

  private need(): Room {
    return this.room ?? fail("NO_ROOM");
  }

  private touch(r: Room) {
    r.seq += 1;
    r.expiresAt = this.now() + ROOM_TTL_MS;
  }

  private deadline(r: Room): number | null {
    return r.turnSeconds ? this.now() + r.turnSeconds * 1000 : null;
  }

  /** Hết hạn phòng / hết giờ lượt – gọi định kỳ (như hub hỏi lại máy chủ). Trả true khi phòng đổi. */
  tick(): boolean {
    const r = this.room;
    if (!r || r.status === "FINISHED") return false;
    const now = this.now();
    if (r.expiresAt <= now) {
      r.status = "FINISHED";
      r.result = { reason: "expired" };
      r.turnSeat = null;
      r.turnDeadline = null;
      r.seq += 1;
      return true;
    }
    if (r.status === "PLAYING") {
      const skip = skipExpiredTurns(
        this.active(),
        r.turnSeat,
        r.turnDeadline === null ? null : new Date(r.turnDeadline),
        r.turnSeconds,
        new Date(now),
      );
      if (skip) {
        r.turnSeat = skip.turnSeat;
        r.turnDeadline = skip.deadline.getTime();
        r.seq += 1;
        return true;
      }
    }
    return false;
  }

  create(user: { id: string; name: string }, body: Record<string, unknown>): MockRoomView {
    const maxPlayers = body.maxPlayers === undefined ? 2 : body.maxPlayers;
    if (!intIn(maxPlayers, MIN_PLAYERS, MAX_PLAYERS)) fail("VALIDATION_ERROR");
    if (body.turnSeconds !== undefined && !intIn(body.turnSeconds, 5, 600)) fail("VALIDATION_ERROR");
    if (body.state !== undefined && jsonBytes(body.state) > MAX_STATE_BYTES) fail("ROOM_STATE_TOO_LARGE");
    const now = this.now();
    this.room = {
      code: newRoomCode(this.random),
      hostId: user.id,
      status: "WAITING",
      seq: 0,
      maxPlayers: maxPlayers as number,
      turnSeconds: (body.turnSeconds as number | undefined) ?? null,
      turnSeat: null,
      turnDeadline: null,
      expiresAt: now + ROOM_TTL_MS,
      state: body.state === undefined ? null : structuredClone(body.state),
      result: null,
      players: [{ id: user.id, name: user.name, seat: 0, left: false }],
      moves: [],
    };
    return this.view(user.id);
  }

  join(user: { id: string; name: string }, code: unknown): MockRoomView {
    this.tick();
    const r = this.room;
    const c = typeof code === "string" ? code.toUpperCase() : "";
    if (!isRoomCode(c)) fail("VALIDATION_ERROR");
    if (!r || r.code !== c) return fail("ROOM_NOT_FOUND");
    const mine = r.players.find((p) => p.id === user.id);
    if (mine && !mine.left) return this.view(user.id);
    if (r.status !== "WAITING") fail("ROOM_STARTED");
    const seat = freeSeat(this.active(), r.maxPlayers);
    if (seat === null) return fail("ROOM_FULL");
    r.players = r.players.filter((p) => p.id !== user.id);
    r.players.push({ id: user.id, name: user.name, seat, left: false });
    r.players.sort((a, b) => a.seat - b.seat);
    this.touch(r);
    return this.view(user.id);
  }

  leave(userId: string): MockRoomView {
    this.tick();
    const r = this.need();
    const me = r.players.find((p) => p.id === userId && !p.left);
    if (!me || r.status === "FINISHED") return this.view(userId);
    const remaining = this.active().filter((s) => s !== me.seat);
    if (r.status === "WAITING" && r.hostId === userId) {
      r.status = "FINISHED";
      r.result = { reason: "host_left" };
    } else if (r.status === "PLAYING" && remaining.length < MIN_PLAYERS) {
      r.status = "FINISHED";
      r.turnSeat = null;
      r.turnDeadline = null;
      r.result = { reason: "abandoned", winnerSeat: remaining[0] ?? null };
    } else if (r.status === "PLAYING" && r.turnSeat === me.seat) {
      r.turnSeat = nextSeat(remaining, me.seat);
      r.turnDeadline = this.deadline(r);
    }
    me.left = true;
    r.seq += 1;
    return this.view(userId);
  }

  start(userId: string): MockRoomView {
    this.tick();
    const r = this.need();
    if (r.hostId !== userId) fail("NOT_ROOM_HOST");
    if (r.status !== "WAITING") fail("ROOM_STARTED");
    const seats = this.active();
    if (seats.length < MIN_PLAYERS) fail("ROOM_NOT_ENOUGH_PLAYERS");
    r.status = "PLAYING";
    r.turnSeat = nextSeat(seats, null);
    r.turnDeadline = this.deadline(r);
    this.touch(r);
    return this.view(userId);
  }

  move(userId: string, body: Record<string, unknown>): MockRoomView {
    this.tick();
    const r = this.need();
    if (r.status !== "PLAYING") fail("ROOM_NOT_PLAYING");
    const me = r.players.find((p) => p.id === userId && !p.left) ?? fail("NOT_IN_ROOM");
    if (r.turnSeat !== me.seat) fail("NOT_YOUR_TURN");
    if (body.seq !== undefined && body.seq !== r.seq) fail("ROOM_CHANGED");
    if (body.data === undefined) fail("VALIDATION_ERROR");
    if (jsonBytes(body.data) > MAX_MOVE_BYTES) fail("ROOM_MOVE_TOO_LARGE");
    if (body.state !== undefined && jsonBytes(body.state) > MAX_STATE_BYTES) fail("ROOM_STATE_TOO_LARGE");
    const next = body.next;
    if (next !== undefined && next !== "next" && next !== "same" && !intIn(next, 0, MAX_PLAYERS - 1)) fail("VALIDATION_ERROR");
    const finish = body.finish as { winnerSeat?: unknown; scores?: unknown } | undefined;
    if (finish !== undefined) {
      if (!finish || typeof finish !== "object") fail("VALIDATION_ERROR");
      const w = finish.winnerSeat;
      if (w !== undefined && w !== null && !intIn(w, 0, MAX_PLAYERS - 1)) fail("VALIDATION_ERROR");
    }
    let turnSeat: number | null;
    try {
      turnSeat = finish ? null : resolveNext(this.active(), me.seat, next);
    } catch {
      return fail("NEXT_SEAT_INVALID");
    }
    const since = r.seq;
    r.seq += 1;
    r.expiresAt = this.now() + ROOM_TTL_MS;
    r.turnSeat = turnSeat;
    r.turnDeadline = turnSeat !== null ? this.deadline(r) : null;
    if (body.state !== undefined) r.state = structuredClone(body.state);
    if (finish) {
      r.status = "FINISHED";
      r.result = { reason: "finished", winnerSeat: finish.winnerSeat ?? null, scores: finish.scores ?? null, bySeat: me.seat };
    }
    r.moves.push({ seq: r.seq, seat: me.seat, data: structuredClone(body.data), at: this.now() });
    return this.view(userId, since);
  }

  /** Dữ liệu phòng như người userId thấy; since = seq đã thấy → kèm các nước đi mới hơn (tối đa 100) */
  view(userId: string | null, since?: number): MockRoomView {
    const r = this.need();
    const me = r.players.find((p) => p.id === userId && !p.left);
    const moves = since !== undefined && since < r.seq ? r.moves.filter((m) => m.seq > since).slice(0, 100) : [];
    return {
      code: r.code,
      status: r.status,
      seq: r.seq,
      maxPlayers: r.maxPlayers,
      turnSeconds: r.turnSeconds,
      turnSeat: r.turnSeat,
      turnDeadline: r.turnDeadline === null ? null : new Date(r.turnDeadline).toISOString(),
      mySeat: me?.seat ?? null,
      myTurn: r.status === "PLAYING" && me !== undefined && me.seat === r.turnSeat,
      isHost: r.hostId === userId,
      state: r.state ?? null,
      result: r.result ?? null,
      players: r.players.map((p) => ({ seat: p.seat, name: p.name, host: p.id === r.hostId, left: p.left })),
      moves: moves.map((m) => ({ seq: m.seq, seat: m.seat, data: m.data, at: new Date(m.at).toISOString() })),
    };
  }

  /** Người chơi đang tới lượt (để Sandbox biết người chơi ảo nào được đi) */
  turnPlayerId(): string | null {
    const r = this.room;
    if (!r || r.status !== "PLAYING") return null;
    return r.players.find((p) => !p.left && p.seat === r.turnSeat)?.id ?? null;
  }

  /** Người chơi ảo còn trong phòng */
  bots(prefix = "bot"): { id: string; name: string; seat: number }[] {
    return (this.room?.players ?? []).filter((p) => !p.left && p.id.startsWith(prefix)).map(({ id, name, seat }) => ({ id, name, seat }));
  }
}
