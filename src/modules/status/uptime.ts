import "server-only";
import { prisma } from "@/lib/prisma";
import { redisPipeline, redisRest, type RedisCommand } from "@/lib/traffic/redis";
import { raiseAnomaly, sendTelegram } from "@/lib/traffic/alerts";
import { log } from "@/lib/log";

/**
 * Kiểm tra định kỳ từ máy chủ (GitHub Actions gọi mỗi 10 phút + trang status gọi khi cần, tối đa 1 lần / 4 phút):
 * ghi kết quả theo ngày vào Redis (giữ 95 ngày) cho thanh uptime 90 ngày ở monlabs.fun/status,
 * và báo Telegram khi 1 thành phần chuyển sang lỗi / hồi phục.
 */
export const COMPONENTS = ["hub", "api", "platform", "docs", "site"] as const;
export type Component = (typeof COMPONENTS)[number];
type Result = { ok: boolean; ms: number | null; error?: string };

const DAY_TTL = 95 * 86400;
/** Lịch GitHub Actions hay chạy trễ / bỏ lượt → hub tự kiểm tra khi lần gần nhất cũ hơn mức này */
export const STALE_MS = 10 * 60_000;
const LOCK_SEC = 240;
const TIMEOUT_MS = 8000;

const SITE = process.env.STATUS_SITE_URL || "https://monlabs.fun/";
const DOCS = process.env.STATUS_DOCS_URL || "https://docs.monlabs.fun/";

async function timed(fn: () => Promise<boolean>): Promise<Result> {
  const t0 = Date.now();
  try {
    const ok = await Promise.race([
      fn(),
      new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
    ]);
    return { ok, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, ms: null, error: err instanceof Error ? err.message.slice(0, 120) : "error" };
  }
}

const fetchOk = (url: string) => () =>
  fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) }).then((r) => r.ok);

/** Các phép kiểm tra – chạy bên trong hub nên "hub" = trang web chạy được, "api" = database trả lời */
export async function runChecks(): Promise<Record<Component, Result>> {
  const hubUrl = process.env.NEXT_PUBLIC_APP_URL || "https://play.monlabs.fun";
  const [hub, api, platform, docs, site] = await Promise.all([
    timed(async () => true), // tiến trình đang chạy được tới đây
    timed(async () => {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    }),
    timed(() =>
      fetch(`${hubUrl.replace(/\/+$/, "")}/api/p1/project`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) }).then(
        async (r) => r.status === 401 && ((await r.json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code === "INVALID_API_KEY",
      ),
    ),
    timed(fetchOk(DOCS)),
    timed(fetchOk(SITE)),
  ]);
  return { hub, api, platform, docs, site };
}

function day(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Chạy kiểm tra (nếu chưa ai chạy trong 4 phút qua) → ghi số liệu + cảnh báo khi đổi trạng thái */
export async function checkAndRecord(now = Date.now()) {
  const redis = redisRest();
  if (!redis) return { ran: false, reason: "NO_REDIS" as const };
  const [lock] = await redisPipeline(redis, [["SET", "status:lock", String(now), "NX", "EX", LOCK_SEC]]);
  if (lock !== "OK") return { ran: false, reason: "RECENT" as const };

  const results = await runChecks();
  const key = `status:d:${day(now)}`;
  const commands: RedisCommand[] = [];
  for (const c of COMPONENTS) commands.push(["HINCRBY", key, `${c}:${results[c].ok ? "ok" : "fail"}`, 1]);
  commands.push(["EXPIRE", key, DAY_TTL], ["GET", "status:last"]);
  const res = await redisPipeline(redis, commands, 2000);
  const previous = parseLast(res[res.length - 1]);
  await redisPipeline(redis, [["SET", "status:last", JSON.stringify({ at: now, results })]]);

  // Báo khi đổi trạng thái (lỗi → Telegram 1 lần; hồi phục → báo lại)
  for (const c of COMPONENTS) {
    const was = previous?.results?.[c]?.ok;
    const nowOk = results[c].ok;
    if (was !== false && !nowOk) {
      await raiseAnomaly("component_down", `${c} không phản hồi${results[c].error ? ` (${results[c].error})` : ""}`, {
        data: { component: c },
        dedupeKey: `down:${c}`,
        dedupeSec: 3600,
      });
    } else if (was === false && nowOk) {
      await sendTelegram(`✅ Monlabs – ${c} đã hoạt động lại`);
    }
  }
  return { ran: true, at: now, results };
}

type Last = { at: number; results: Partial<Record<Component, Result>> };
function parseLast(raw: unknown): Last | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as Last;
  } catch {
    return null;
  }
}

/** Dữ liệu cho trang status: kết quả lần kiểm tra gần nhất + số lần ok/lỗi từng ngày (90 ngày) */
export async function getUptime(days = 90, now = Date.now()) {
  const redis = redisRest();
  if (!redis) return { last: null, days: [] };
  const dates = Array.from({ length: days }, (_, i) => day(now - (days - 1 - i) * 86400_000));
  const res = await redisPipeline(redis, [["GET", "status:last"], ...dates.map((d): RedisCommand => ["HGETALL", `status:d:${d}`])], 2000);
  const last = parseLast(res[0]);
  const out = dates.map((date, i) => {
    const flat = (res[i + 1] as string[] | null) ?? [];
    const h: Record<string, number> = {};
    for (let j = 0; j + 1 < flat.length; j += 2) h[flat[j]!] = Number(flat[j + 1]);
    const comps: Partial<Record<Component, { ok: number; fail: number }>> = {};
    for (const c of COMPONENTS) {
      const ok = h[`${c}:ok`] ?? 0;
      const fail = h[`${c}:fail`] ?? 0;
      if (ok + fail > 0) comps[c] = { ok, fail };
    }
    return { date, ...comps };
  });
  return { last, days: out };
}

/**
 * Dự phòng cho lịch GitHub: lần kiểm tra gần nhất đã cũ hơn 10 phút → chạy luôn (khóa 4 phút trong checkAndRecord
 * chống chạy trùng). Gọi từ request thật của người chơi (tối đa 1 lần / phút) và khi có người mở trang status.
 */
export async function checkIfStale(now = Date.now()) {
  const redis = redisRest();
  if (!redis) return null;
  try {
    const [raw] = await redisPipeline(redis, [["GET", "status:last"]]);
    const last = parseLast(raw);
    if (last && now - last.at < STALE_MS) return null;
    return await checkAndRecord(now);
  } catch (err) {
    log.warn("status.fallback_check_failed", { area: "status", error: err });
    return null;
  }
}
