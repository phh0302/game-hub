import { ApiError } from "./api";
import { reportError } from "./monitoring";

/**
 * Rate limit theo cửa sổ cố định (fixed window).
 *
 * - Có Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, hoặc KV_REST_API_URL + KV_REST_API_TOKEN
 *   do tích hợp Upstash trên Vercel tự tạo) → mọi server dùng chung 1 bộ đếm → chặn được thật trên Vercel.
 * - Không có → đếm trong bộ nhớ từng server (đủ cho máy dev / chạy 1 server).
 * - Redis lỗi / chậm → tạm dùng bộ nhớ, KHÔNG chặn người dùng (fail-open) và ghi lỗi để theo dõi.
 */

const RATE_LIMITED_MESSAGE = "Bạn thao tác quá nhanh, thử lại sau ít phút";

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const redis = redisConfig();
  let count: number | null = null;
  if (redis) {
    try {
      count = await redisIncrement(redis, key, windowMs);
    } catch (err) {
      void reportError(err, { tags: { area: "rate-limit" } });
    }
  }
  if (count === null) count = memoryIncrement(key, windowMs);
  if (count > limit) throw new ApiError(429, "RATE_LIMITED", RATE_LIMITED_MESSAGE);
}

/** Đang dùng bộ đếm nào (hiện ở /api/v1/health) */
export function rateLimitBackend(): "redis" | "memory" {
  return redisConfig() ? "redis" : "memory";
}

// ---------- Upstash Redis (REST, không cần thư viện) ----------

type RedisConfig = { url: string; token: string };

function redisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

async function redisIncrement({ url, token }: RedisConfig, key: string, windowMs: number): Promise<number> {
  const window = Math.floor(Date.now() / windowMs);
  const redisKey = `rl:${key}:${window}`;
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PEXPIRE", redisKey, String(windowMs + 1000)],
    ]),
    signal: AbortSignal.timeout(1500),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ result?: unknown; error?: string }>;
  const first = data[0];
  if (!first || first.error || typeof first.result !== "number") throw new Error(`Upstash: ${first?.error ?? "phản hồi lạ"}`);
  return first.result;
}

// ---------- Bộ nhớ (dự phòng) ----------

type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as unknown as { __rateLimit?: Map<string, Bucket> };
const store = (globalStore.__rateLimit ??= new Map<string, Bucket>());

function memoryIncrement(key: string, windowMs: number): number {
  const now = Date.now();
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    cleanup(now);
    return 1;
  }
  bucket.count += 1;
  return bucket.count;
}

let lastCleanup = 0;
function cleanup(now: number) {
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}
