import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const periodSchema = z.enum(["day", "week", "all"]).default("all");
export type Period = z.infer<typeof periodSchema>;

// Bảng xếp hạng ngày/tuần tính theo giờ Việt Nam (UTC+7)
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Thời điểm bắt đầu kỳ xếp hạng: 0h hôm nay / 0h thứ Hai tuần này (giờ VN) */
export function periodStart(period: Period, now = new Date()): Date {
  if (period === "all") return new Date(0);
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  let start = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate());
  if (period === "week") {
    const daysSinceMonday = (vn.getUTCDay() + 6) % 7;
    start -= daysSinceMonday * DAY_MS;
  }
  return new Date(start - VN_OFFSET_MS);
}

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  walletAddress: string;
  username: string | null;
  avatarUrl: string | null;
  score: number;
  achievedAt: Date;
};

/**
 * Top người chơi: mỗi người lấy điểm cao nhất trong kỳ.
 * Bằng điểm thì ai đạt trước xếp trên.
 */
export async function getLeaderboard(gameId: string, period: Period, limit = 50): Promise<LeaderboardEntry[]> {
  const since = periodStart(period);
  const rows = await prisma.$queryRaw<Omit<LeaderboardEntry, "rank">[]>`
    SELECT u.id AS "userId", u."walletAddress", u.username, u."avatarUrl",
           b.best AS score, b."achievedAt"
    FROM (
      SELECT DISTINCT ON (s."userId") s."userId", s.value AS best, s."createdAt" AS "achievedAt"
      FROM "Score" s
      WHERE s."gameId" = ${gameId} AND s."createdAt" >= ${since}
      ORDER BY s."userId", s.value DESC, s."createdAt" ASC
    ) b
    JOIN "User" u ON u.id = b."userId"
    ORDER BY b.best DESC, b."achievedAt" ASC
    LIMIT ${limit}
  `;
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

/** Hạng và điểm cao nhất của 1 người chơi trong kỳ (null nếu chưa có điểm) */
export async function getUserRank(gameId: string, userId: string, period: Period) {
  const since = periodStart(period);
  const rows = await prisma.$queryRaw<{ score: number; rank: number; achievedAt: Date }[]>`
    WITH best AS (
      SELECT DISTINCT ON ("userId") "userId", value AS best, "createdAt" AS "achievedAt"
      FROM "Score"
      WHERE "gameId" = ${gameId} AND "createdAt" >= ${since}
      ORDER BY "userId", value DESC, "createdAt" ASC
    )
    SELECT me.best AS score, me."achievedAt",
           (SELECT COUNT(*) FROM best o
             WHERE o.best > me.best OR (o.best = me.best AND o."achievedAt" < me."achievedAt"))::int + 1 AS rank
    FROM best me
    WHERE me."userId" = ${userId}
  `;
  return rows[0] ?? null;
}
