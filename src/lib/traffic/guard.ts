// Lớp chặn ở middleware (edge) – không import server-only / Prisma
import {
  BLOCK_SEC,
  BURST_LIMIT,
  BURST_WINDOW_SEC,
  GROUP_LIMITS,
  secondsToWindowEnd,
  type TrafficGroup,
} from "./limits";
import { redisPipeline, redisRest } from "./redis";

export type GuardResult =
  | { ok: true }
  | { ok: false; code: "RATE_LIMITED" | "IP_BLOCKED"; retryAfter: number; justBlocked?: boolean };

const BANS_KEY = "traffic:bans"; // sorted set: IP → thời điểm hết chặn (ms)

/**
 * Kiểm tra 1 request: IP đang bị chặn? vượt giới hạn nhóm? gửi dồn dập (→ chặn tạm)?
 * Redis lỗi → dùng bộ nhớ của server này (fail-open: không chặn nhầm người dùng vì Redis hỏng).
 */
export async function guardRequest(ip: string, group: TrafficGroup, now = Date.now()): Promise<GuardResult> {
  const redis = redisRest();
  if (redis) {
    try {
      return await guardRedis(redis, ip, group, now);
    } catch (err) {
      console.error("[traffic] Redis lỗi, dùng bộ nhớ", err);
    }
  }
  return guardMemory(ip, group, now);
}

async function guardRedis(redis: NonNullable<ReturnType<typeof redisRest>>, ip: string, group: TrafficGroup, now: number) {
  const { limit, windowSec } = GROUP_LIMITS[group];
  const groupKey = `traffic:rl:${group}:${ip}:${Math.floor(now / (windowSec * 1000))}`;
  const burstKey = `traffic:burst:${ip}:${Math.floor(now / (BURST_WINDOW_SEC * 1000))}`;
  const banKey = `traffic:ban:${ip}`;
  const [ttl, groupCount, , burstCount] = (await redisPipeline(redis, [
    ["TTL", banKey],
    ["INCR", groupKey],
    ["EXPIRE", groupKey, windowSec + 1],
    ["INCR", burstKey],
    ["EXPIRE", burstKey, BURST_WINDOW_SEC + 1],
  ])) as [number, number, unknown, number, unknown];

  if (typeof ttl === "number" && ttl > 0) return blocked("IP_BLOCKED", ttl);
  if (burstCount > BURST_LIMIT) {
    await redisPipeline(redis, [
      ["SET", banKey, JSON.stringify({ at: now, group, burst: burstCount }), "EX", BLOCK_SEC],
      ["ZADD", BANS_KEY, now + BLOCK_SEC * 1000, ip],
      ["ZREMRANGEBYSCORE", BANS_KEY, 0, now],
    ]).catch(() => undefined);
    return { ...blocked("IP_BLOCKED", BLOCK_SEC), justBlocked: true };
  }
  if (groupCount > limit) return blocked("RATE_LIMITED", secondsToWindowEnd(windowSec, now));
  return { ok: true } as const;
}

function blocked(code: "RATE_LIMITED" | "IP_BLOCKED", retryAfter: number): GuardResult {
  return { ok: false, code, retryAfter: Math.max(1, Math.ceil(retryAfter)) };
}

// ---------- Bộ nhớ (dự phòng / máy dev) ----------

type Counter = { count: number; resetAt: number };
const g = globalThis as unknown as { __traffic?: { counters: Map<string, Counter>; bans: Map<string, number> } };
const mem = (g.__traffic ??= { counters: new Map(), bans: new Map() });

function bump(key: string, windowSec: number, now: number): number {
  const c = mem.counters.get(key);
  if (!c || c.resetAt <= now) {
    mem.counters.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    if (mem.counters.size > 50_000) mem.counters.clear(); // tránh phình bộ nhớ khi bị tấn công
    return 1;
  }
  c.count += 1;
  return c.count;
}

function guardMemory(ip: string, group: TrafficGroup, now: number): GuardResult {
  const until = mem.bans.get(ip);
  if (until && until > now) return blocked("IP_BLOCKED", (until - now) / 1000);
  const { limit, windowSec } = GROUP_LIMITS[group];
  const burst = bump(`b:${ip}:${Math.floor(now / (BURST_WINDOW_SEC * 1000))}`, BURST_WINDOW_SEC, now);
  if (burst > BURST_LIMIT) {
    mem.bans.set(ip, now + BLOCK_SEC * 1000);
    return { ...blocked("IP_BLOCKED", BLOCK_SEC), justBlocked: true };
  }
  const count = bump(`g:${group}:${ip}:${Math.floor(now / (windowSec * 1000))}`, windowSec, now);
  if (count > limit) return blocked("RATE_LIMITED", secondsToWindowEnd(windowSec, now));
  return { ok: true };
}

// ---------- Cho trang quản trị ----------

export type BlockedIp = { ip: string; until: number; at: number | null; group: string | null };

export async function listBlockedIps(now = Date.now()): Promise<BlockedIp[]> {
  const redis = redisRest();
  if (!redis) {
    return [...mem.bans.entries()].filter(([, until]) => until > now).map(([ip, until]) => ({ ip, until, at: null, group: null }));
  }
  await redisPipeline(redis, [["ZREMRANGEBYSCORE", BANS_KEY, 0, now]]);
  const [flat] = (await redisPipeline(redis, [["ZRANGEBYSCORE", BANS_KEY, now, "+inf", "WITHSCORES"]])) as [string[]];
  const items: BlockedIp[] = [];
  for (let i = 0; i < (flat?.length ?? 0); i += 2) items.push({ ip: flat[i]!, until: Number(flat[i + 1]), at: null, group: null });
  if (items.length > 0) {
    const metas = (await redisPipeline(redis, items.map((it) => ["GET", `traffic:ban:${it.ip}`]))) as (string | null)[];
    metas.forEach((m, i) => {
      try {
        const meta = m ? (JSON.parse(m) as { at?: number; group?: string }) : null;
        items[i]!.at = meta?.at ?? null;
        items[i]!.group = meta?.group ?? null;
      } catch {
        /* bỏ qua */
      }
    });
  }
  return items.sort((a, b) => b.until - a.until);
}

export async function unblockIp(ip: string): Promise<boolean> {
  const redis = redisRest();
  if (!redis) return mem.bans.delete(ip);
  const [deleted] = (await redisPipeline(redis, [
    ["DEL", `traffic:ban:${ip}`],
    ["ZREM", BANS_KEY, ip],
  ])) as [number, number];
  return deleted > 0;
}
