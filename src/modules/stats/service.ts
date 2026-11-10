import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { pickTranslation } from "@/lib/locale";

/**
 * Thống kê cho admin – tính thẳng từ dữ liệu đang có (User, GameSession, Score, Event).
 * Ngày tính theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè).
 */

export const statsQuerySchema = z.object({ days: z.enum(["7", "30", "90"]).default("30").transform(Number) });

const TZ_OFFSET_MS = 7 * 3600_000;

/** Ngày đầu tiên của khoảng (0h giờ VN, đổi về UTC) + danh sách ngày YYYY-MM-DD */
function range(days: number, now = new Date()) {
  const localMidnight = Math.floor((now.getTime() + TZ_OFFSET_MS) / 86_400_000) * 86_400_000;
  const startLocal = localMidnight - (days - 1) * 86_400_000;
  const keys = Array.from({ length: days }, (_, i) => new Date(startLocal + i * 86_400_000).toISOString().slice(0, 10));
  return { since: new Date(startLocal - TZ_OFFSET_MS), keys };
}

type DayRow = { d: string; n: number };

export async function adminStats(days: number, locale: string) {
  const { since, keys } = range(days);

  const [newUsers, sessionsByDay, anonByDay, totals, perGameSessions, perGameAnon, perGameScores, games] = await Promise.all([
    prisma.$queryRaw<DayRow[]>`
      SELECT to_char("createdAt" + interval '7 hours', 'YYYY-MM-DD') AS d, count(*)::int AS n
      FROM "User" WHERE "createdAt" >= ${since} AND "isGuest" = false AND "deletedAt" IS NULL
      GROUP BY 1`,
    prisma.$queryRaw<{ d: string; sessions: number; players: number }[]>`
      SELECT to_char("startedAt" + interval '7 hours', 'YYYY-MM-DD') AS d,
             count(*)::int AS sessions, count(DISTINCT "userId")::int AS players
      FROM "GameSession" WHERE "startedAt" >= ${since}
      GROUP BY 1`,
    prisma.$queryRaw<DayRow[]>`
      SELECT to_char("createdAt" + interval '7 hours', 'YYYY-MM-DD') AS d, count(*)::int AS n
      FROM "Event" WHERE type = 'play.anonymous' AND "createdAt" >= ${since}
      GROUP BY 1`,
    prisma.$queryRaw<{ users: number; players: number; scores: number; rejected: number; openReports: number }[]>`
      SELECT
        (SELECT count(*)::int FROM "User" WHERE "isGuest" = false AND "deletedAt" IS NULL) AS users,
        (SELECT count(DISTINCT "userId")::int FROM "GameSession" WHERE "startedAt" >= ${since}) AS players,
        (SELECT count(*)::int FROM "Score" WHERE "createdAt" >= ${since}) AS scores,
        (SELECT count(*)::int FROM "Event" WHERE type = 'score.rejected' AND "createdAt" >= ${since}) AS rejected,
        (SELECT count(*)::int FROM "GameReport" WHERE status = 'OPEN') AS "openReports"`,
    prisma.$queryRaw<{ gameId: string; sessions: number; players: number }[]>`
      SELECT "gameId", count(*)::int AS sessions, count(DISTINCT "userId")::int AS players
      FROM "GameSession" WHERE "startedAt" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<{ gameId: string; n: number }[]>`
      SELECT "gameId", count(*)::int AS n
      FROM "Event" WHERE type = 'play.anonymous' AND "createdAt" >= ${since} AND "gameId" IS NOT NULL GROUP BY 1`,
    prisma.$queryRaw<{ gameId: string; scores: number; avgSeconds: number | null }[]>`
      SELECT "gameId", count(*)::int AS scores, round(avg("durationSeconds"))::int AS "avgSeconds"
      FROM "Score" WHERE "createdAt" >= ${since} GROUP BY 1`,
    prisma.game.findMany({
      where: { deletedAt: null },
      select: { id: true, slug: true, status: true, translations: { select: { locale: true, name: true } } },
    }),
  ]);

  const byKey = <T extends { d: string }>(rows: T[]) => new Map(rows.map((r) => [r.d, r]));
  const users = byKey(newUsers);
  const sess = byKey(sessionsByDay);
  const anon = byKey(anonByDay);
  const daily = keys.map((d) => ({
    date: d,
    newUsers: users.get(d)?.n ?? 0,
    sessions: sess.get(d)?.sessions ?? 0,
    anonymousPlays: anon.get(d)?.n ?? 0,
    players: sess.get(d)?.players ?? 0,
  }));

  const sMap = new Map(perGameSessions.map((r) => [r.gameId, r]));
  const aMap = new Map(perGameAnon.map((r) => [r.gameId, r.n]));
  const scMap = new Map(perGameScores.map((r) => [r.gameId, r]));
  const perGame = games
    .map((g) => {
      const sessions = sMap.get(g.id)?.sessions ?? 0;
      const anonymousPlays = aMap.get(g.id) ?? 0;
      return {
        slug: g.slug,
        name: pickTranslation(g.translations, locale)?.name ?? g.slug,
        status: g.status,
        plays: sessions + anonymousPlays,
        sessions,
        anonymousPlays,
        players: sMap.get(g.id)?.players ?? 0,
        scores: scMap.get(g.id)?.scores ?? 0,
        avgSeconds: scMap.get(g.id)?.avgSeconds ?? null,
      };
    })
    .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name));

  const t = totals[0];
  return {
    days,
    totals: {
      users: t.users,
      newUsers: daily.reduce((s, d) => s + d.newUsers, 0),
      players: t.players,
      plays: daily.reduce((s, d) => s + d.sessions + d.anonymousPlays, 0),
      anonymousPlays: daily.reduce((s, d) => s + d.anonymousPlays, 0),
      scores: t.scores,
      rejected: t.rejected,
      openReports: t.openReports,
    },
    daily,
    perGame,
  };
}
