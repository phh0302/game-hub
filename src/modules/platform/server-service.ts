import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { pickTranslation } from "@/lib/locale";
import { displayName, toNumber } from "@/lib/format";
import { logEvent } from "@/modules/events/service";
import { boardKeySchema, getLeaderboardByKey } from "@/modules/scores/leaderboard";
import { adminCreateBoard, adminListBoards, boardCreateSchema, listPublicBoards } from "@/modules/scores/boards-admin";
import { submitScoreForGame } from "@/modules/scores/service";
import { primaryWallet, userWithIdentities } from "@/modules/users/dto";
import type { ServerContext } from "./server";

/** Nghiệp vụ của Server API (/api/s1) – mọi thao tác chỉ trong phạm vi project của secret key */

export async function serverProjectInfo(ctx: ServerContext, locale: string) {
  const game = await prisma.game.findUniqueOrThrow({ where: { id: ctx.game.id }, include: { translations: true } });
  return {
    id: game.id,
    slug: game.slug,
    status: game.status,
    name: pickTranslation(game.translations, locale)?.name ?? game.slug,
    scoreSubmission: ctx.game.parsedSettings.scoreSubmission,
    allowedOrigins: game.allowedOrigins,
    leaderboards: await listPublicBoards(game.id, locale),
  };
}

// ───────────── Điểm ─────────────

export const exportScoresQuery = z.object({
  leaderboard: boardKeySchema,
  /** Chỉ lấy điểm từ thời điểm này (ISO 8601) – dùng để đồng bộ dần */
  since: z.coerce.date().optional(),
  /** Phân trang: id điểm cuối cùng của trang trước */
  cursor: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

/** Xuất điểm theo thời gian nộp (cũ → mới), kèm người chơi – để game lưu / phân tích ở hệ thống riêng */
export async function exportScores(ctx: ServerContext, query: z.infer<typeof exportScoresQuery>) {
  const board = await getLeaderboardByKey(ctx.game.id, query.leaderboard);
  const rows = await prisma.score.findMany({
    where: { leaderboardId: board.id, ...(query.since ? { createdAt: { gte: query.since } } : {}) },
    include: { user: { include: userWithIdentities } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, query.limit);
  return {
    leaderboard: board.key,
    scores: page.map((s) => ({
      id: s.id,
      sessionId: s.sessionId,
      value: toNumber(s.value),
      durationSeconds: s.durationSeconds,
      createdAt: s.createdAt,
      player: playerSummary(s.user),
    })),
    nextCursor: rows.length > query.limit ? page[page.length - 1]!.id : null,
  };
}

function playerSummary(user: Parameters<typeof primaryWallet>[0]) {
  const walletAddress = primaryWallet(user);
  return {
    id: user.id,
    displayName: displayName({ id: user.id, username: user.username, walletAddress }),
    walletAddress,
    isGuest: user.isGuest,
  };
}

export const serverSubmitSchema = z.object({
  /** Lượt chơi do game mở qua Client API (POST /api/p1/sessions) – máy chủ đã tính giờ từ lúc đó */
  sessionId: z.string().min(1).max(50),
  score: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  leaderboard: boardKeySchema,
});

/**
 * Máy chủ của game nộp điểm sau khi tự kiểm tra ván chơi. Người chơi lấy từ lượt chơi,
 * vẫn áp dụng luật chống gian lận (thời gian máy chủ đo, ngưỡng điểm) và lệnh cấm.
 */
export async function serverSubmitScore(ctx: ServerContext, input: z.infer<typeof serverSubmitSchema>) {
  const session = await prisma.gameSession.findUnique({ where: { id: input.sessionId } });
  if (!session || session.gameId !== ctx.game.id) {
    throw new ApiError(404, "SESSION_NOT_FOUND", "Không tìm thấy lượt chơi");
  }
  return submitScoreForGame(session.userId, ctx.game, input, "server");
}

/** Xóa điểm gian lận: xóa mọi điểm của cùng lượt chơi (gồm điểm đã ghi vào giải đấu ăn theo) */
export async function deleteScore(ctx: ServerContext, scoreId: string, reason?: string) {
  const score = await prisma.score.findUnique({ where: { id: scoreId } });
  if (!score || score.gameId !== ctx.game.id) throw new ApiError(404, "SCORE_NOT_FOUND", "Không tìm thấy điểm");
  const res = await prisma.score.deleteMany({ where: { sessionId: score.sessionId, gameId: ctx.game.id } });
  await logEvent({
    type: "score.deleted",
    userId: score.userId,
    gameId: ctx.game.id,
    data: { scoreId, sessionId: score.sessionId, value: toNumber(score.value), deleted: res.count, reason: reason ?? null },
  });
  return { deleted: res.count };
}

// ───────────── Người chơi ─────────────

async function findProjectPlayer(ctx: ServerContext, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userWithIdentities });
  // Chỉ thấy người chơi đã từng chơi game này (không tra cứu được người dùng khác của hub)
  const played = user && (await prisma.gameSession.count({ where: { gameId: ctx.game.id, userId } }));
  const banned = user && (await prisma.projectBan.findUnique({ where: { gameId_userId: { gameId: ctx.game.id, userId } } }));
  if (!user || user.deletedAt || (!played && !banned)) {
    throw new ApiError(404, "PLAYER_NOT_FOUND", "Không tìm thấy người chơi trong game này");
  }
  return { user, sessions: played || 0, ban: banned || null };
}

export async function getProjectPlayer(ctx: ServerContext, userId: string) {
  const { user, sessions, ban } = await findProjectPlayer(ctx, userId);
  const best = await prisma.score.groupBy({
    by: ["leaderboardId"],
    where: { gameId: ctx.game.id, userId },
    _max: { value: true },
    _min: { value: true },
    _count: { _all: true },
  });
  const boards = await prisma.leaderboard.findMany({ where: { id: { in: best.map((b) => b.leaderboardId) } } });
  return {
    player: playerSummary(user),
    sessions,
    banned: ban ? { reason: ban.reason, at: ban.createdAt } : null,
    boards: best.map((b) => {
      const board = boards.find((x) => x.id === b.leaderboardId);
      const value = board?.order === "ASC" ? b._min.value : b._max.value;
      return { leaderboard: board?.key ?? null, best: value === null ? null : toNumber(value), scores: b._count._all };
    }),
  };
}

export const banSchema = z.object({
  reason: z.string().trim().max(300).optional(),
  /** Xóa luôn mọi điểm của người chơi trong game này */
  deleteScores: z.boolean().optional(),
});

export async function banPlayer(ctx: ServerContext, userId: string, input: z.infer<typeof banSchema>) {
  await findProjectPlayer(ctx, userId);
  await prisma.projectBan.upsert({
    where: { gameId_userId: { gameId: ctx.game.id, userId } },
    create: { gameId: ctx.game.id, userId, reason: input.reason ?? null },
    update: { reason: input.reason ?? null },
  });
  const deleted = input.deleteScores
    ? (await prisma.score.deleteMany({ where: { gameId: ctx.game.id, userId } })).count
    : 0;
  await logEvent({ type: "player.ban", userId, gameId: ctx.game.id, data: { reason: input.reason ?? null, deletedScores: deleted } });
  return { banned: true, deletedScores: deleted };
}

export async function unbanPlayer(ctx: ServerContext, userId: string) {
  const res = await prisma.projectBan.deleteMany({ where: { gameId: ctx.game.id, userId } });
  if (res.count === 0) throw new ApiError(404, "BAN_NOT_FOUND", "Người chơi này không bị cấm");
  await logEvent({ type: "player.unban", userId, gameId: ctx.game.id });
  return { banned: false };
}

// ───────────── Bảng xếp hạng & giải đấu ─────────────

export async function serverListBoards(ctx: ServerContext) {
  return adminListBoards(ctx.game.id);
}

/** Tạo giải đấu / bảng phụ – cùng luật như admin (vd mirrorOf: "default" để không cần sửa game) */
export async function serverCreateBoard(ctx: ServerContext, body: unknown) {
  const input = boardCreateSchema.parse(body);
  const board = await adminCreateBoard(ctx.game.id, input, null);
  return { leaderboard: (await adminListBoards(ctx.game.id)).find((b) => b.id === board.id) ?? null };
}
