import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { logEvent } from "@/modules/events/service";
import { readLeaderboardSettings } from "@/modules/games/settings";
import { isBoardOpen } from "./period";

/**
 * Admin quản lý bảng xếp hạng của game: thêm bảng phụ, tổ chức giải đấu có thời hạn.
 * Bảng "default" luôn có (tạo cùng game) và không xóa được.
 */

const keySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Mã bảng chỉ gồm chữ thường, số, gạch ngang")
  .min(2)
  .max(50);

const namesSchema = z.object({
  vi: z.string().trim().min(1).max(80),
  en: z.string().trim().max(80).nullable().optional(),
});

const limitsSchema = z.object({
  maxScore: z.number().int().nonnegative().nullable().optional(),
  minScore: z.number().int().nonnegative().nullable().optional(),
  maxScorePerSecond: z.number().positive().nullable().optional(),
});

const dateSchema = z.coerce.date().nullable().optional();

export const boardCreateSchema = z
  .object({
    key: keySchema,
    names: namesSchema,
    order: z.enum(["ASC", "DESC"]).optional(),
    startsAt: dateSchema,
    endsAt: dateSchema,
    /** Nhận điểm tự động từ bảng này (vd "default") – để trống = game phải tự gửi điểm vào key mới */
    mirrorOf: keySchema.nullable().optional(),
  })
  .merge(limitsSchema)
  .refine((v) => v.key !== "default", { message: "Bảng default đã có sẵn", path: ["key"] })
  .refine((v) => !v.startsAt || !v.endsAt || v.startsAt < v.endsAt, {
    message: "Thời gian kết thúc phải sau thời gian bắt đầu",
    path: ["endsAt"],
  });

export const boardUpdateSchema = z
  .object({
    names: namesSchema.optional(),
    startsAt: dateSchema,
    endsAt: dateSchema,
  })
  .merge(limitsSchema);

type BoardWithT = Prisma.LeaderboardGetPayload<{ include: { translations: true } }>;

function boardStatus(b: { startsAt: Date | null; endsAt: Date | null }, now = new Date()) {
  if (b.startsAt && b.startsAt > now) return "UPCOMING" as const;
  if (b.endsAt && b.endsAt <= now) return "ENDED" as const;
  return "OPEN" as const;
}

function toAdminBoard(b: BoardWithT, counts: Map<string, { scores: number; players: number }>) {
  const s = readLeaderboardSettings(b.settings);
  const name = (locale: string) => b.translations.find((t) => t.locale === locale)?.name ?? null;
  return {
    id: b.id,
    key: b.key,
    names: { vi: name("vi"), en: name("en") },
    order: b.order,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    status: boardStatus(b),
    mirrorOf: s.mirrorOf ?? null,
    format: s.format ?? "number",
    maxScore: s.maxScore ?? null,
    minScore: s.minScore ?? null,
    maxScorePerSecond: s.maxScorePerSecond ?? null,
    scores: counts.get(b.id)?.scores ?? 0,
    players: counts.get(b.id)?.players ?? 0,
  };
}

async function loadGame(gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.deletedAt) throw new ApiError(404, "GAME_NOT_FOUND", "Không tìm thấy game");
  return game;
}

export async function adminListBoards(gameId: string) {
  await loadGame(gameId);
  const boards = await prisma.leaderboard.findMany({
    where: { gameId, deletedAt: null },
    include: { translations: true },
    orderBy: [{ startsAt: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
  });
  const stats = await prisma.$queryRaw<{ leaderboardId: string; scores: number; players: number }[]>`
    SELECT "leaderboardId", count(*)::int AS scores, count(DISTINCT "userId")::int AS players
    FROM "Score" WHERE "gameId" = ${gameId} GROUP BY 1`;
  const counts = new Map(stats.map((r) => [r.leaderboardId, r]));
  // Bảng default luôn đứng đầu
  boards.sort((a, b) => (a.key === "default" ? -1 : b.key === "default" ? 1 : 0));
  return boards.map((b) => toAdminBoard(b, counts));
}

function limitsJson(input: z.infer<typeof limitsSchema>, base: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...base };
  for (const k of ["maxScore", "minScore", "maxScorePerSecond"] as const) {
    if (input[k] === undefined) continue;
    if (input[k] === null) delete out[k];
    else out[k] = input[k];
  }
  return out as Prisma.InputJsonObject;
}

export async function adminCreateBoard(gameId: string, input: z.infer<typeof boardCreateSchema>, actorId: string) {
  await loadGame(gameId);
  const exists = await prisma.leaderboard.findUnique({ where: { gameId_key: { gameId, key: input.key } } });
  if (exists && !exists.deletedAt) throw new ApiError(409, "BOARD_KEY_TAKEN", "Mã bảng này đã có trong game");

  // Giải đấu ăn theo bảng nguồn: kế thừa thứ tự, kiểu hiển thị và luật chống gian lận của bảng nguồn
  let base: Record<string, unknown> = {};
  let order = input.order ?? "DESC";
  if (input.mirrorOf) {
    const source = await prisma.leaderboard.findUnique({ where: { gameId_key: { gameId, key: input.mirrorOf } } });
    if (!source || source.deletedAt) throw new ApiError(404, "LEADERBOARD_NOT_FOUND", "Không tìm thấy bảng nguồn");
    if (readLeaderboardSettings(source.settings).mirrorOf) {
      throw new ApiError(400, "MIRROR_CHAIN", "Bảng nguồn không được là giải đấu ăn theo bảng khác");
    }
    base = { ...(source.settings as Record<string, unknown>), mirrorOf: input.mirrorOf };
    order = source.order;
  }

  const data = {
    order,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    settings: limitsJson(input, base),
    deletedAt: null,
  };
  const names = [
    { locale: "vi", name: input.names.vi },
    ...(input.names.en ? [{ locale: "en", name: input.names.en }] : []),
  ];

  const board = await prisma.$transaction(async (tx) => {
    // Mã từng bị xóa → dùng lại bản ghi cũ (giữ ràng buộc unique gameId + key)
    const b = exists
      ? await tx.leaderboard.update({ where: { id: exists.id }, data })
      : await tx.leaderboard.create({ data: { gameId, key: input.key, ...data } });
    await tx.leaderboardTranslation.deleteMany({ where: { leaderboardId: b.id } });
    await tx.leaderboardTranslation.createMany({ data: names.map((n) => ({ leaderboardId: b.id, ...n })) });
    return b;
  });
  await logEvent({ type: "leaderboard.create", userId: actorId, gameId, data: { key: input.key, mirrorOf: input.mirrorOf ?? null } });
  return board;
}

export async function adminUpdateBoard(id: string, input: z.infer<typeof boardUpdateSchema>, actorId: string) {
  const board = await prisma.leaderboard.findUnique({ where: { id } });
  if (!board || board.deletedAt) throw new ApiError(404, "LEADERBOARD_NOT_FOUND", "Không tìm thấy bảng xếp hạng");
  const startsAt = input.startsAt === undefined ? board.startsAt : input.startsAt;
  const endsAt = input.endsAt === undefined ? board.endsAt : input.endsAt;
  if (startsAt && endsAt && startsAt >= endsAt) {
    throw new ApiError(400, "VALIDATION_ERROR", "Thời gian kết thúc phải sau thời gian bắt đầu");
  }

  await prisma.$transaction(async (tx) => {
    if (input.names) {
      for (const [locale, name] of Object.entries(input.names)) {
        if (name) {
          await tx.leaderboardTranslation.upsert({
            where: { leaderboardId_locale: { leaderboardId: id, locale } },
            create: { leaderboardId: id, locale, name },
            update: { name },
          });
        } else {
          await tx.leaderboardTranslation.deleteMany({ where: { leaderboardId: id, locale } });
        }
      }
    }
    await tx.leaderboard.update({
      where: { id },
      data: { startsAt, endsAt, settings: limitsJson(input, board.settings as Record<string, unknown>) },
    });
  });
  await logEvent({ type: "leaderboard.update", userId: actorId, gameId: board.gameId, data: { key: board.key } });
}

/** Xóa mềm (giữ điểm để tra cứu). Không xóa được bảng default */
export async function adminDeleteBoard(id: string, actorId: string) {
  const board = await prisma.leaderboard.findUnique({ where: { id } });
  if (!board || board.deletedAt) throw new ApiError(404, "LEADERBOARD_NOT_FOUND", "Không tìm thấy bảng xếp hạng");
  if (board.key === "default") throw new ApiError(400, "DEFAULT_BOARD", "Không xóa được bảng xếp hạng mặc định");
  await prisma.leaderboard.update({ where: { id }, data: { deletedAt: new Date() } });
  await logEvent({ type: "leaderboard.delete", userId: actorId, gameId: board.gameId, data: { key: board.key } });
}

/** Bảng hiển thị cho người chơi: đang diễn ra, sắp diễn ra (≤ 14 ngày) hoặc vừa kết thúc (≤ 30 ngày) */
export async function listPublicBoards(gameId: string, locale: string) {
  const now = Date.now();
  const boards = await prisma.leaderboard.findMany({
    where: { gameId, deletedAt: null },
    include: { translations: true },
    orderBy: { createdAt: "asc" },
  });
  return boards
    .filter((b) => {
      if (b.key === "default") return true;
      if (b.startsAt && b.startsAt.getTime() - now > 14 * 86_400_000) return false;
      if (b.endsAt && now - b.endsAt.getTime() > 30 * 86_400_000) return false;
      return true;
    })
    .sort((a, b) => (a.key === "default" ? -1 : b.key === "default" ? 1 : 0))
    .map((b) => ({
      key: b.key,
      name:
        b.translations.find((t) => t.locale === locale)?.name ?? b.translations.find((t) => t.locale === "vi")?.name ?? null,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      status: boardStatus(b),
      isOpen: isBoardOpen(b),
      mirrorOf: readLeaderboardSettings(b.settings).mirrorOf ?? null,
    }));
}
