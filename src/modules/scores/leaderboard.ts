import "server-only";
import { z } from "zod";
import { Prisma, type Leaderboard } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { assetUrl } from "@/lib/assets";
import { displayName, toNumber } from "@/lib/format";
import { pickTranslation } from "@/lib/locale";

export const periodSchema = z.enum(["day", "week", "all"]).default("all");
export type Period = z.infer<typeof periodSchema>;

export const boardKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(50)
  .default("default");

// Kỳ ngày/tuần tính theo giờ Việt Nam (UTC+7)
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Thời điểm bắt đầu kỳ: 0h hôm nay / 0h thứ Hai tuần này (giờ VN) */
export function periodStart(period: Period, now = new Date()): Date {
  if (period === "all") return new Date(0);
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  let start = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate());
  if (period === "week") start -= ((vn.getUTCDay() + 6) % 7) * DAY_MS;
  return new Date(start - VN_OFFSET_MS);
}

export async function getLeaderboardByKey(gameId: string, key: string) {
  const board = await prisma.leaderboard.findUnique({
    where: { gameId_key: { gameId, key } },
    include: { translations: true },
  });
  if (!board || board.deletedAt) {
    throw new ApiError(404, "LEADERBOARD_NOT_FOUND", "Không tìm thấy bảng xếp hạng");
  }
  return board;
}

/** Bảng xếp hạng có đang nhận điểm không (giải đấu có thời gian bắt đầu/kết thúc) */
export function isBoardOpen(board: Pick<Leaderboard, "startsAt" | "endsAt">, now = new Date()) {
  return (!board.startsAt || board.startsAt <= now) && (!board.endsAt || now < board.endsAt);
}

/** Khoảng thời gian tính điểm = giao của kỳ (ngày/tuần) với thời gian của bảng xếp hạng */
function scoreWindow(board: Pick<Leaderboard, "startsAt" | "endsAt">, period: Period) {
  const start = periodStart(period);
  const since = board.startsAt && board.startsAt > start ? board.startsAt : start;
  const untilFilter = board.endsAt ? Prisma.sql`AND s."createdAt" < ${board.endsAt}` : Prisma.empty;
  return { since, untilFilter };
}

type BoardRow = {
  userId: string;
  username: string | null;
  avatarKey: string | null;
  walletAddress: string | null;
  score: bigint;
  achievedAt: Date;
};

/**
 * Top người chơi: mỗi người lấy điểm tốt nhất trong kỳ
 * (cao nhất nếu order=DESC, thấp nhất nếu order=ASC). Bằng điểm thì ai đạt trước xếp trên.
 */
export async function getTopEntries(board: Leaderboard, period: Period, limit = 50) {
  const dir = board.order === "ASC" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const { since, untilFilter } = scoreWindow(board, period);

  const rows = await prisma.$queryRaw<BoardRow[]>`
    SELECT u.id AS "userId", u.username, u."avatarKey", w."providerUserId" AS "walletAddress",
           b.best AS score, b."achievedAt"
    FROM (
      SELECT DISTINCT ON (s."userId") s."userId", s.value AS best, s."createdAt" AS "achievedAt"
      FROM "Score" s
      WHERE s."leaderboardId" = ${board.id} AND s."createdAt" >= ${since} ${untilFilter}
      ORDER BY s."userId", s.value ${dir}, s."createdAt" ASC
    ) b
    JOIN "User" u ON u.id = b."userId" AND u."deletedAt" IS NULL
    LEFT JOIN LATERAL (
      SELECT ai."providerUserId" FROM "AuthIdentity" ai
      WHERE ai."userId" = u.id AND ai.provider = 'WALLET'
      ORDER BY ai."createdAt" ASC LIMIT 1
    ) w ON true
    ORDER BY b.best ${dir}, b."achievedAt" ASC
    LIMIT ${limit}
  `;

  return rows.map((row, i) => ({
    rank: i + 1,
    userId: row.userId,
    displayName: displayName({ id: row.userId, username: row.username, walletAddress: row.walletAddress }),
    walletAddress: row.walletAddress,
    avatarUrl: assetUrl(row.avatarKey),
    score: toNumber(row.score),
    achievedAt: row.achievedAt,
  }));
}

/** Hạng + điểm tốt nhất của 1 người trong kỳ (null nếu chưa có điểm) */
export async function getUserRank(board: Leaderboard, userId: string, period: Period) {
  const dir = board.order === "ASC" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const better = board.order === "ASC" ? Prisma.sql`<` : Prisma.sql`>`;
  const { since, untilFilter } = scoreWindow(board, period);

  const rows = await prisma.$queryRaw<{ score: bigint; rank: number; achievedAt: Date }[]>`
    WITH best AS (
      SELECT DISTINCT ON (s."userId") s."userId", s.value AS best, s."createdAt" AS "achievedAt"
      FROM "Score" s
      WHERE s."leaderboardId" = ${board.id} AND s."createdAt" >= ${since} ${untilFilter}
      ORDER BY s."userId", s.value ${dir}, s."createdAt" ASC
    )
    SELECT me.best AS score, me."achievedAt",
           (SELECT COUNT(*) FROM best o
             WHERE o.best ${better} me.best OR (o.best = me.best AND o."achievedAt" < me."achievedAt"))::int + 1 AS rank
    FROM best me
    WHERE me."userId" = ${userId}
  `;
  const row = rows[0];
  return row ? { rank: row.rank, score: toNumber(row.score), achievedAt: row.achievedAt } : null;
}

export function toBoardDto(board: Leaderboard & { translations: { locale: string; name: string }[] }, locale: string) {
  return {
    key: board.key,
    name: pickTranslation(board.translations, locale)?.name ?? null,
    order: board.order,
    startsAt: board.startsAt,
    endsAt: board.endsAt,
    isOpen: isBoardOpen(board),
  };
}
