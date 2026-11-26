import "server-only";
import { Prisma, RoomStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { displayName } from "@/lib/format";
import { getPlayableGame } from "@/modules/games/service";
import { primaryWallet, userWithIdentities, type UserWithIdentities } from "@/modules/users/dto";
import {
  freeSeat,
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
} from "./rules";

export const roomCreateSchema = z.object({
  maxPlayers: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS).default(2),
  /** Giới hạn mỗi lượt (giây); bỏ trống = không giới hạn */
  turnSeconds: z.number().int().min(5).max(600).optional(),
  /** Trạng thái ban đầu do game định nghĩa */
  state: z.unknown().optional(),
});

export const roomMoveSchema = z.object({
  /** Nước đi (JSON ≤ 8KB) – mọi người trong phòng nhận được */
  data: z.unknown(),
  /** Trạng thái chung mới (JSON ≤ 32KB) – bỏ trống = giữ nguyên */
  state: z.unknown().optional(),
  /** Lượt tiếp theo: "next" (mặc định), "same", hoặc số ghế */
  next: z.union([z.literal("next"), z.literal("same"), z.number().int().min(0).max(MAX_PLAYERS - 1)]).optional(),
  /** Kết thúc ván: người thắng (ghế) hoặc null = hòa, kèm điểm từng ghế nếu có */
  finish: z
    .object({
      winnerSeat: z.number().int().min(0).max(MAX_PLAYERS - 1).nullable().optional(),
      scores: z.record(z.string().regex(/^\d$/), z.number().int().min(0)).optional(),
    })
    .optional(),
  /** seq đã thấy gần nhất – lệch (người khác vừa đi) → 409 để game tải lại */
  seq: z.number().int().min(0).optional(),
});

const roomInclude = {
  players: { include: { user: { include: userWithIdentities } }, orderBy: { seat: "asc" } },
} satisfies Prisma.RoomInclude;
type RoomFull = Prisma.RoomGetPayload<{ include: typeof roomInclude }>;

const active = (room: RoomFull) => room.players.filter((p) => !p.leftAt).map((p) => p.seat);
const ttl = () => new Date(Date.now() + ROOM_TTL_MS);

function assertSize(value: unknown, max: number, code: string) {
  if (value !== undefined && jsonBytes(value) > max) throw new ApiError(413, code, `Dữ liệu quá ${Math.round(max / 1024)}KB`);
}

async function findRoom(gameId: string, code: string): Promise<RoomFull> {
  const room = await prisma.room.findFirst({
    where: { gameId, code: code.toUpperCase(), status: { not: RoomStatus.FINISHED } },
    include: roomInclude,
    orderBy: { createdAt: "desc" },
  });
  if (room) return room;
  const finished = await prisma.room.findFirst({ where: { gameId, code: code.toUpperCase() }, include: roomInclude, orderBy: { createdAt: "desc" } });
  if (!finished) throw new ApiError(404, "ROOM_NOT_FOUND", "Không tìm thấy phòng");
  return finished;
}

/** Cập nhật có kiểm tra seq (2 người cùng ghi → 1 người nhận 409 ROOM_CHANGED và tải lại) */
async function bump(room: RoomFull, data: Prisma.RoomUpdateManyMutationInput) {
  const res = await prisma.room.updateMany({ where: { id: room.id, seq: room.seq }, data: { ...data, seq: room.seq + 1, expiresAt: ttl() } });
  if (res.count === 0) throw new ApiError(409, "ROOM_CHANGED", "Phòng vừa thay đổi – tải lại rồi thử lại");
}

/** Phòng hết hạn / hết giờ lượt → cập nhật trước khi trả về */
async function refresh(room: RoomFull): Promise<RoomFull> {
  const now = new Date();
  if (room.status !== RoomStatus.FINISHED && room.expiresAt <= now) {
    await prisma.room.updateMany({ where: { id: room.id, seq: room.seq }, data: { status: RoomStatus.FINISHED, result: { reason: "expired" }, seq: room.seq + 1 } });
    return prisma.room.findUniqueOrThrow({ where: { id: room.id }, include: roomInclude });
  }
  if (room.status === RoomStatus.PLAYING) {
    const skip = skipExpiredTurns(active(room), room.turnSeat, room.turnDeadline, room.turnSeconds, now);
    if (skip) {
      await prisma.room.updateMany({
        where: { id: room.id, seq: room.seq },
        data: { turnSeat: skip.turnSeat, turnDeadline: skip.deadline, seq: room.seq + 1 },
      });
      return prisma.room.findUniqueOrThrow({ where: { id: room.id }, include: roomInclude });
    }
  }
  return room;
}

async function toDto(room: RoomFull, userId: string | null, since?: number) {
  const moves =
    since !== undefined && since < room.seq
      ? await prisma.roomMove.findMany({ where: { roomId: room.id, seq: { gt: since } }, orderBy: { seq: "asc" }, take: 100 })
      : [];
  const me = room.players.find((p) => p.userId === userId && !p.leftAt);
  return {
    code: room.code,
    status: room.status,
    seq: room.seq,
    maxPlayers: room.maxPlayers,
    turnSeconds: room.turnSeconds,
    turnSeat: room.turnSeat,
    turnDeadline: room.turnDeadline?.toISOString() ?? null,
    mySeat: me?.seat ?? null,
    myTurn: room.status === RoomStatus.PLAYING && me !== undefined && me.seat === room.turnSeat,
    isHost: room.hostId === userId,
    state: room.state ?? null,
    result: room.result ?? null,
    players: room.players.map((p) => ({
      seat: p.seat,
      name: displayName({ id: p.user.id, username: p.user.username, walletAddress: primaryWallet(p.user) }),
      host: p.userId === room.hostId,
      left: Boolean(p.leftAt),
    })),
    moves: moves.map((m) => ({ seq: m.seq, seat: m.seat, data: m.data, at: m.createdAt.toISOString() })),
  };
}

export type RoomDto = Awaited<ReturnType<typeof toDto>>;

export async function createRoom(user: UserWithIdentities, slug: string, input: z.infer<typeof roomCreateSchema>) {
  const game = await getPlayableGame(slug);
  assertSize(input.state, MAX_STATE_BYTES, "ROOM_STATE_TOO_LARGE");
  // Mỗi người chỉ giữ 1 phòng chờ / game: đóng phòng chờ cũ
  await prisma.room.updateMany({
    where: { gameId: game.id, hostId: user.id, status: RoomStatus.WAITING },
    data: { status: RoomStatus.FINISHED, result: { reason: "replaced" } },
  });
  for (let i = 0; i < 5; i++) {
    const code = newRoomCode();
    const clash = await prisma.room.findFirst({ where: { gameId: game.id, code, status: { not: RoomStatus.FINISHED } }, select: { id: true } });
    if (clash) continue;
    const room = await prisma.room.create({
      data: {
        gameId: game.id,
        code,
        hostId: user.id,
        maxPlayers: input.maxPlayers,
        turnSeconds: input.turnSeconds ?? null,
        ...(input.state === undefined ? {} : { state: input.state as Prisma.InputJsonValue }),
        expiresAt: ttl(),
        players: { create: { userId: user.id, seat: 0 } },
      },
      include: roomInclude,
    });
    return toDto(room, user.id);
  }
  throw new ApiError(503, "ROOM_CODE_BUSY", "Không tạo được mã phòng, thử lại");
}

export async function getRoom(user: UserWithIdentities | null, slug: string, code: string, since?: number) {
  const game = await getPlayableGame(slug);
  const room = await refresh(await findRoom(game.id, code));
  return toDto(room, user?.id ?? null, since);
}

export async function joinRoom(user: UserWithIdentities, slug: string, code: string) {
  const game = await getPlayableGame(slug);
  const room = await refresh(await findRoom(game.id, code));
  const mine = room.players.find((p) => p.userId === user.id);
  if (mine && !mine.leftAt) return toDto(room, user.id);
  if (room.status !== RoomStatus.WAITING) throw new ApiError(409, "ROOM_STARTED", "Phòng đã bắt đầu hoặc đã kết thúc");
  const seat = freeSeat(active(room), room.maxPlayers);
  if (seat === null) throw new ApiError(409, "ROOM_FULL", "Phòng đã đủ người");
  await prisma.$transaction(async (tx) => {
    const res = await tx.room.updateMany({ where: { id: room.id, seq: room.seq }, data: { seq: room.seq + 1, expiresAt: ttl() } });
    if (res.count === 0) throw new ApiError(409, "ROOM_CHANGED", "Phòng vừa thay đổi – thử lại");
    if (mine) await tx.roomPlayer.delete({ where: { roomId_userId: { roomId: room.id, userId: user.id } } });
    await tx.roomPlayer.create({ data: { roomId: room.id, userId: user.id, seat } });
  });
  return getRoom(user, slug, code);
}

export async function leaveRoom(user: UserWithIdentities, slug: string, code: string) {
  const game = await getPlayableGame(slug);
  const room = await refresh(await findRoom(game.id, code));
  const me = room.players.find((p) => p.userId === user.id && !p.leftAt);
  if (!me || room.status === RoomStatus.FINISHED) return toDto(room, user.id);
  const remaining = active(room).filter((s) => s !== me.seat);
  let data: Prisma.RoomUpdateManyMutationInput = {};
  if (room.status === RoomStatus.WAITING && room.hostId === user.id) {
    data = { status: RoomStatus.FINISHED, result: { reason: "host_left" } };
  } else if (room.status === RoomStatus.PLAYING && remaining.length < MIN_PLAYERS) {
    data = { status: RoomStatus.FINISHED, turnSeat: null, turnDeadline: null, result: { reason: "abandoned", winnerSeat: remaining[0] ?? null } };
  } else if (room.status === RoomStatus.PLAYING && room.turnSeat === me.seat) {
    data = { turnSeat: nextSeat(remaining, me.seat), turnDeadline: room.turnSeconds ? new Date(Date.now() + room.turnSeconds * 1000) : null };
  }
  await prisma.$transaction([
    prisma.roomPlayer.update({ where: { roomId_userId: { roomId: room.id, userId: user.id } }, data: { leftAt: new Date() } }),
    prisma.room.update({ where: { id: room.id }, data: { ...data, seq: { increment: 1 } } }),
  ]);
  return getRoom(user, slug, code);
}

export async function startRoom(user: UserWithIdentities, slug: string, code: string) {
  const game = await getPlayableGame(slug);
  const room = await refresh(await findRoom(game.id, code));
  if (room.hostId !== user.id) throw new ApiError(403, "NOT_ROOM_HOST", "Chỉ chủ phòng được bắt đầu");
  if (room.status !== RoomStatus.WAITING) throw new ApiError(409, "ROOM_STARTED", "Phòng đã bắt đầu hoặc đã kết thúc");
  const seats = active(room);
  if (seats.length < MIN_PLAYERS) throw new ApiError(409, "ROOM_NOT_ENOUGH_PLAYERS", "Cần ít nhất 2 người");
  await bump(room, {
    status: RoomStatus.PLAYING,
    turnSeat: nextSeat(seats, null),
    turnDeadline: room.turnSeconds ? new Date(Date.now() + room.turnSeconds * 1000) : null,
  });
  return getRoom(user, slug, code);
}

export async function moveRoom(user: UserWithIdentities, slug: string, code: string, input: z.infer<typeof roomMoveSchema>) {
  const game = await getPlayableGame(slug);
  const room = await refresh(await findRoom(game.id, code));
  if (room.status !== RoomStatus.PLAYING) throw new ApiError(409, "ROOM_NOT_PLAYING", "Ván chưa bắt đầu hoặc đã kết thúc");
  const me = room.players.find((p) => p.userId === user.id && !p.leftAt);
  if (!me) throw new ApiError(403, "NOT_IN_ROOM", "Bạn không ở trong phòng này");
  if (room.turnSeat !== me.seat) throw new ApiError(409, "NOT_YOUR_TURN", "Chưa tới lượt bạn");
  if (input.seq !== undefined && input.seq !== room.seq) throw new ApiError(409, "ROOM_CHANGED", "Phòng vừa thay đổi – tải lại rồi thử lại");
  if (input.data === undefined) throw new ApiError(400, "VALIDATION_ERROR", "Thiếu nước đi (data)");
  assertSize(input.data, MAX_MOVE_BYTES, "ROOM_MOVE_TOO_LARGE");
  assertSize(input.state, MAX_STATE_BYTES, "ROOM_STATE_TOO_LARGE");

  const seats = active(room);
  let turnSeat: number | null;
  try {
    turnSeat = input.finish ? null : resolveNext(seats, me.seat, input.next);
  } catch {
    throw new ApiError(400, "NEXT_SEAT_INVALID", "Ghế tiếp theo không có người chơi");
  }
  const seq = room.seq + 1;
  await prisma.$transaction(async (tx) => {
    const res = await tx.room.updateMany({
      where: { id: room.id, seq: room.seq },
      data: {
        seq,
        expiresAt: ttl(),
        turnSeat,
        turnDeadline: turnSeat !== null && room.turnSeconds ? new Date(Date.now() + room.turnSeconds * 1000) : null,
        ...(input.state !== undefined ? { state: input.state as Prisma.InputJsonValue } : {}),
        ...(input.finish
          ? {
              status: RoomStatus.FINISHED,
              result: { reason: "finished", winnerSeat: input.finish.winnerSeat ?? null, scores: input.finish.scores ?? null, bySeat: me.seat },
            }
          : {}),
      },
    });
    if (res.count === 0) throw new ApiError(409, "ROOM_CHANGED", "Phòng vừa thay đổi – tải lại rồi thử lại");
    await tx.roomMove.create({ data: { roomId: room.id, seq, seat: me.seat, data: input.data as Prisma.InputJsonValue } });
  });
  return getRoom(user, slug, code, room.seq);
}
