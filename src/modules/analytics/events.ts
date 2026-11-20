import "server-only";
import { redisPipeline, redisRest, type RedisCommand } from "@/lib/traffic/redis";
import type { GameEvent } from "@/lib/game-events";

/**
 * Lưu sự kiện game trong Redis:
 * - ga:{gameId}:{ngày UTC}  hash tên sự kiện → số lần (giữ 95 ngày)
 * - ga:recent:{gameId}      50 sự kiện gần nhất kèm props (để developer kiểm tra tích hợp)
 * Giới hạn chống lạm dụng: 200 tên sự kiện khác nhau / game / ngày, 200.000 sự kiện / game / ngày.
 */
const DAY_TTL = 95 * 86400;
const MAX_NAMES_PER_DAY = 200;
const MAX_EVENTS_PER_DAY = 200_000;
const RECENT = 50;

function day(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export type RecordResult = { accepted: number; dropped: number; reason?: "NO_STORE" | "DAILY_LIMIT" };

export async function recordGameEvents(
  gameId: string,
  events: GameEvent[],
  source: "hub" | "api",
  now = Date.now(),
): Promise<RecordResult> {
  if (events.length === 0) return { accepted: 0, dropped: 0 };
  const redis = redisRest();
  if (!redis) return { accepted: 0, dropped: events.length, reason: "NO_STORE" };
  const key = `ga:${gameId}:${day(now)}`;
  const capKey = `ga:cap:${gameId}:${day(now)}`;
  const [total, names] = await redisPipeline(redis, [
    ["INCRBY", capKey, events.length],
    ["HLEN", key],
    ["EXPIRE", capKey, 2 * 86400],
  ]);
  if (Number(total) > MAX_EVENTS_PER_DAY) return { accepted: 0, dropped: events.length, reason: "DAILY_LIMIT" };

  // Tên sự kiện mới chỉ nhận khi chưa vượt số tên / ngày
  const allowNew = Number(names) < MAX_NAMES_PER_DAY;
  let existing: Set<string> | null = null;
  if (!allowNew) {
    const res = await redisPipeline(redis, [["HKEYS", key]]);
    existing = new Set((res[0] as string[] | null) ?? []);
  }
  const kept = events.filter((e) => allowNew || existing!.has(e.name));
  if (kept.length === 0) return { accepted: 0, dropped: events.length, reason: "DAILY_LIMIT" };

  const counts = new Map<string, number>();
  for (const e of kept) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  const commands: RedisCommand[] = [...counts].map(([name, n]): RedisCommand => ["HINCRBY", key, name, n]);
  commands.push(["EXPIRE", key, DAY_TTL]);
  const recentKey = `ga:recent:${gameId}`;
  for (const e of kept.slice(-10)) {
    commands.push(["LPUSH", recentKey, JSON.stringify({ name: e.name, props: e.props ?? null, at: now, source })]);
  }
  commands.push(["LTRIM", recentKey, 0, RECENT - 1], ["EXPIRE", recentKey, DAY_TTL]);
  await redisPipeline(redis, commands);
  return { accepted: kept.length, dropped: events.length - kept.length };
}

export type GameEventStats = {
  days: { date: string; total: number }[];
  events: { name: string; total: number; today: number }[];
  recent: { name: string; props: Record<string, unknown> | null; at: number; source: string }[];
};

/** Thống kê cho trang Developer: tổng theo ngày, theo tên sự kiện, 50 sự kiện gần nhất */
export async function getGameEventStats(gameId: string, daysBack: number, now = Date.now()): Promise<GameEventStats> {
  const redis = redisRest();
  if (!redis) return { days: [], events: [], recent: [] };
  const dates = Array.from({ length: daysBack }, (_, i) => day(now - (daysBack - 1 - i) * 86400_000));
  const res = await redisPipeline(
    redis,
    [...dates.map((d): RedisCommand => ["HGETALL", `ga:${gameId}:${d}`]), ["LRANGE", `ga:recent:${gameId}`, 0, RECENT - 1]],
    3000,
  );
  const per = new Map<string, { total: number; today: number }>();
  const days = dates.map((date, i) => {
    const flat = (res[i] as string[] | null) ?? [];
    let total = 0;
    for (let j = 0; j + 1 < flat.length; j += 2) {
      const n = Number(flat[j + 1]);
      total += n;
      const cur = per.get(flat[j]!) ?? { total: 0, today: 0 };
      cur.total += n;
      if (i === dates.length - 1) cur.today += n;
      per.set(flat[j]!, cur);
    }
    return { date, total };
  });
  const recent = ((res[dates.length] as string[] | null) ?? []).flatMap((raw) => {
    try {
      return [JSON.parse(raw) as GameEventStats["recent"][number]];
    } catch {
      return [];
    }
  });
  const events = [...per].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);
  return { days, events, recent };
}
