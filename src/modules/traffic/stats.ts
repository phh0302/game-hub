import "server-only";
import { prisma } from "@/lib/prisma";
import { redisPipeline, redisRest, type RedisCommand } from "@/lib/traffic/redis";
import { hourIpKey, hourKey, hourOf, minuteKey, minuteOf, percentileFromHistogram } from "@/lib/traffic/stats-keys";
import { listAnomalies } from "@/lib/traffic/alerts";
import { listBlockedIps } from "@/lib/traffic/guard";
import { est, toBucket, type Bucket } from "./detect";

export type StatsRange = "1h" | "24h" | "7d" | "30d";
export const STATS_RANGES: StatsRange[] = ["1h", "24h", "7d", "30d"];

export type SeriesPoint = {
  t: number; // mốc thời gian (ms, đầu phút / giờ / ngày)
  requests: number; // ước tính (đã chia tỷ lệ lấy mẫu)
  errors: number; // 5xx ước tính
  clientErrors: number; // 4xx ước tính
  blocked: number; // 429/413 do lớp chặn – đếm đủ
};

export type TrafficStats = {
  range: StatsRange;
  step: "minute" | "hour" | "day";
  source: "redis" | "database" | "none";
  sampleRate: number | null;
  series: SeriesPoint[];
  totals: { requests: number; errors: number; clientErrors: number; blocked: number; errorRate: number | null };
  latency: { p50: number | null; p95: number | null; p99: number | null };
  groups: { name: string; requests: number }[];
  routes: { name: string; requests: number }[];
  topIps: { ipHash: string; requests: number }[];
  blockedCodes: { code: string; count: number }[];
};

const DAY_MS = 24 * 3600 * 1000;

/** Số liệu cho trang stats: 1h (theo phút), 24h / 7d (theo giờ) từ Redis, 30d (theo ngày) từ bảng TrafficDaily */
export async function getTrafficStats(range: StatsRange, now = Date.now()): Promise<TrafficStats> {
  if (range === "30d") return fromDatabase(now);
  const redis = redisRest();
  const step = range === "1h" ? "minute" : "hour";
  if (!redis) return empty(range, step, "none");

  const count = range === "1h" ? 60 : range === "24h" ? 24 : 24 * 7;
  const current = step === "minute" ? minuteOf(now) : hourOf(now);
  const slots = Array.from({ length: count }, (_, i) => current - (count - 1 - i));
  const commands: RedisCommand[] = slots.map((s) => ["HGETALL", step === "minute" ? minuteKey(s) : hourKey(s)]);
  // Top IP: theo giờ (đủ cho cả 1h vì giờ hiện tại + giờ trước)
  const ipHours = range === "1h" ? [hourOf(now), hourOf(now) - 1] : slots;
  commands.push(...ipHours.map((h): RedisCommand => ["ZREVRANGE", hourIpKey(h), 0, 9, "WITHSCORES"]));

  const res = await redisPipeline(redis, commands, 3000);
  const buckets = res.slice(0, count).map(toBucket);
  const ipLists = res.slice(count) as (string[] | null)[];
  const unit = step === "minute" ? 60_000 : 3_600_000;

  const stats = summarize(range, step, buckets, slots.map((s) => s * unit));
  stats.topIps = topIps(ipLists);
  return stats;
}

/** Gộp các bucket (phút/giờ) thành chuỗi thời gian + tổng + top route/nhóm + phân vị độ trễ */
export function summarize(range: StatsRange, step: TrafficStats["step"], buckets: Bucket[], times: number[]): TrafficStats {
  const series: SeriesPoint[] = buckets.map((b, i) => ({
    t: times[i]!,
    requests: Math.round(est(b, "req")),
    errors: Math.round(est(b, "s:5xx")),
    clientErrors: Math.round(est(b, "s:4xx")),
    blocked: sumPrefix(b, "blk:"),
  }));
  const totals = series.reduce(
    (a, p) => ({
      requests: a.requests + p.requests,
      errors: a.errors + p.errors,
      clientErrors: a.clientErrors + p.clientErrors,
      blocked: a.blocked + p.blocked,
    }),
    { requests: 0, errors: 0, clientErrors: 0, blocked: 0 },
  );
  const sampledResults = buckets.reduce((a, b) => a + sumPrefix(b, "s:"), 0);
  const sampled5xx = buckets.reduce((a, b) => a + (b["s:5xx"] ?? 0), 0);

  const hist: Record<string, number> = {};
  const groups = new Map<string, number>();
  const routes = new Map<string, number>();
  const codes = new Map<string, number>();
  let rate: number | null = null;
  for (const b of buckets) {
    if (b.rate) rate = b.rate;
    for (const [k, v] of Object.entries(b)) {
      if (k.startsWith("lat:")) hist[k.slice(4)] = (hist[k.slice(4)] ?? 0) + v;
      else if (k.startsWith("g:")) groups.set(k.slice(2), (groups.get(k.slice(2)) ?? 0) + v / (b.rate || 1));
      else if (k.startsWith("r:")) routes.set(k.slice(2), (routes.get(k.slice(2)) ?? 0) + v / (b.rate || 1));
      else if (k.startsWith("blk:")) codes.set(k.slice(4), (codes.get(k.slice(4)) ?? 0) + v);
    }
  }
  const sorted = (m: Map<string, number>, n: number) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, v]) => ({ name, requests: Math.round(v) }));

  return {
    range,
    step,
    source: "redis",
    sampleRate: rate,
    series,
    totals: { ...totals, errorRate: sampledResults > 0 ? sampled5xx / sampledResults : null },
    latency: {
      p50: percentileFromHistogram(hist, 0.5),
      p95: percentileFromHistogram(hist, 0.95),
      p99: percentileFromHistogram(hist, 0.99),
    },
    groups: sorted(groups, 10),
    routes: sorted(routes, 15),
    topIps: [],
    blockedCodes: [...codes.entries()].sort((a, b) => b[1] - a[1]).map(([code, count]) => ({ code, count })),
  };
}

function sumPrefix(b: Bucket, prefix: string): number {
  let n = 0;
  for (const [k, v] of Object.entries(b)) if (k.startsWith(prefix)) n += v;
  return n;
}

function topIps(lists: (string[] | null)[]) {
  const per = new Map<string, number>();
  for (const flat of lists) {
    for (let i = 0; i + 1 < (flat?.length ?? 0); i += 2) per.set(flat![i]!, (per.get(flat![i]!) ?? 0) + Number(flat![i + 1]));
  }
  return [...per.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ipHash, requests]) => ({ ipHash, requests }));
}

function empty(range: StatsRange, step: TrafficStats["step"], source: TrafficStats["source"]): TrafficStats {
  return {
    range,
    step,
    source,
    sampleRate: null,
    series: [],
    totals: { requests: 0, errors: 0, clientErrors: 0, blocked: 0, errorRate: null },
    latency: { p50: null, p95: null, p99: null },
    groups: [],
    routes: [],
    topIps: [],
    blockedCodes: [],
  };
}

type DailyData = { groups?: Record<string, number>; routes?: Record<string, number>; blocked?: Record<string, number>; hist?: Record<string, number> };

async function fromDatabase(now: number): Promise<TrafficStats> {
  const today = startOfUtcDay(now);
  const from = new Date(today - 30 * DAY_MS);
  const rows = await prisma.trafficDaily.findMany({ where: { day: { gte: from } }, orderBy: { day: "asc" } });
  if (rows.length === 0) return empty("30d", "day", "database");
  const buckets: Bucket[] = rows.map((r) => {
    const d = (r.data ?? {}) as DailyData;
    const b: Bucket = { req: r.requests, "s:5xx": r.errors, "s:4xx": r.clientErrors, rate: 1 };
    for (const [k, v] of Object.entries(d.groups ?? {})) b[`g:${k}`] = v;
    for (const [k, v] of Object.entries(d.routes ?? {})) b[`r:${k}`] = v;
    for (const [k, v] of Object.entries(d.blocked ?? {})) b[`blk:${k}`] = v;
    for (const [k, v] of Object.entries(d.hist ?? {})) b[`lat:${k}`] = v;
    b["s:2xx"] = Math.max(0, r.requests - r.errors - r.clientErrors);
    return b;
  });
  const stats = summarize("30d", "day", buckets, rows.map((r) => r.day.getTime()));
  stats.source = "database";
  stats.sampleRate = null;
  return stats;
}

function startOfUtcDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/**
 * Chạy hằng ngày (cron): gộp 24 bucket giờ của ngày hôm qua (UTC) → 1 dòng TrafficDaily.
 * Redis chỉ giữ số liệu giờ 9 ngày; bảng này giữ lâu dài cho trang stats (30 ngày).
 */
export async function rollupTrafficDay(now = Date.now()): Promise<{ day: string; requests: number } | null> {
  const redis = redisRest();
  if (!redis) return null;
  const dayStart = startOfUtcDay(now) - DAY_MS;
  const firstHour = dayStart / 3_600_000;
  const hours = Array.from({ length: 24 }, (_, i) => firstHour + i);
  const res = await redisPipeline(redis, hours.map((h): RedisCommand => ["HGETALL", hourKey(h)]), 3000);
  const s = summarize("24h", "hour", res.map(toBucket), hours.map((h) => h * 3_600_000));
  if (s.totals.requests === 0 && s.totals.blocked === 0) return { day: new Date(dayStart).toISOString().slice(0, 10), requests: 0 };

  const hist: Record<string, number> = {};
  for (const b of res.map(toBucket)) {
    for (const [k, v] of Object.entries(b)) if (k.startsWith("lat:")) hist[k.slice(4)] = (hist[k.slice(4)] ?? 0) + v;
  }
  const data: DailyData = {
    groups: Object.fromEntries(s.groups.map((g) => [g.name, g.requests])),
    routes: Object.fromEntries(s.routes.map((r) => [r.name, r.requests])),
    blocked: Object.fromEntries(s.blockedCodes.map((c) => [c.code, c.count])),
    hist,
  };
  const day = new Date(dayStart);
  const values = {
    requests: s.totals.requests,
    errors: s.totals.errors,
    clientErrors: s.totals.clientErrors,
    blocked: s.totals.blocked,
    p95Ms: s.latency.p95,
    data,
  };
  await prisma.trafficDaily.upsert({ where: { day }, create: { day, ...values }, update: values });
  return { day: day.toISOString().slice(0, 10), requests: s.totals.requests };
}

/** Toàn bộ dữ liệu cho trang stats */
export async function getStatsOverview(range: StatsRange) {
  const [stats, anomalies, blocks] = await Promise.all([getTrafficStats(range), listAnomalies(30), listBlockedIps()]);
  return { stats, anomalies, blocks };
}
