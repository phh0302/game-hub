// Luật phòng chơi theo lượt – hàm thuần để unit test (không import alias / server-only).

export const ROOM_CODE_LENGTH = 6;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const MAX_MOVE_BYTES = 8 * 1024;
export const MAX_STATE_BYTES = 32 * 1024;
export const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // phòng không hoạt động 2 giờ → hết hạn
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ ký tự dễ nhầm

export function newRoomCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return [...random(ROOM_CODE_LENGTH)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function isRoomCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z2-9]{6}$/.test(value);
}

/** Ghế trống nhỏ nhất (0-based) hoặc null khi đầy */
export function freeSeat(taken: number[], maxPlayers: number): number | null {
  for (let s = 0; s < maxPlayers; s++) if (!taken.includes(s)) return s;
  return null;
}

/** Ghế kế tiếp (vòng tròn) trong các ghế còn chơi; current không còn chơi → ghế còn chơi tiếp theo sau nó */
export function nextSeat(active: number[], current: number | null): number | null {
  if (active.length === 0) return null;
  const sorted = [...active].sort((a, b) => a - b);
  if (current === null) return sorted[0]!;
  return sorted.find((s) => s > current) ?? sorted[0]!;
}

/** Lượt tiếp theo theo yêu cầu của game: "next" (mặc định), "same" (đi tiếp), hoặc 1 ghế cụ thể đang chơi */
export function resolveNext(active: number[], current: number, next: unknown): number | null {
  if (next === "same") return active.includes(current) ? current : nextSeat(active, current);
  if (typeof next === "number" && Number.isInteger(next)) {
    if (!active.includes(next)) throw new Error("NEXT_SEAT_INVALID");
    return next;
  }
  return nextSeat(active, current);
}

export function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value ?? null)).byteLength;
}

/**
 * Hết giờ lượt: bỏ qua người đang tới lượt (có thể nhiều lượt nếu đã lâu không ai hỏi).
 * Trả về ghế mới + hạn mới, hoặc null nếu chưa hết giờ / không giới hạn giờ.
 */
export function skipExpiredTurns(
  active: number[],
  turnSeat: number | null,
  deadline: Date | null,
  turnSeconds: number | null,
  now: Date,
): { turnSeat: number; deadline: Date; skipped: number } | null {
  if (turnSeat === null || !deadline || !turnSeconds || deadline > now || active.length === 0) return null;
  const overdue = now.getTime() - deadline.getTime();
  const skipped = Math.min(active.length * 4, 1 + Math.floor(overdue / (turnSeconds * 1000)));
  let seat: number = turnSeat;
  for (let i = 0; i < skipped; i++) seat = nextSeat(active, seat)!;
  const newDeadline = new Date(deadline.getTime() + skipped * turnSeconds * 1000);
  return { turnSeat: seat, deadline: newDeadline > now ? newDeadline : new Date(now.getTime() + turnSeconds * 1000), skipped };
}
