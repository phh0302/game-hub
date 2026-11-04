import { ApiError } from "./api";

/**
 * Rate limit đơn giản trong bộ nhớ (fixed window).
 * Đủ cho MVP chạy 1 server. Khi chạy nhiều instance (Vercel serverless)
 * nên chuyển sang Redis/Upstash để các instance dùng chung bộ đếm.
 */
type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as unknown as { __rateLimit?: Map<string, Bucket> };
const store = (globalStore.__rateLimit ??= new Map<string, Bucket>());

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    cleanup(now);
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    throw new ApiError(429, "RATE_LIMITED", "Bạn thao tác quá nhanh, thử lại sau ít phút");
  }
}

let lastCleanup = 0;
function cleanup(now: number) {
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}
