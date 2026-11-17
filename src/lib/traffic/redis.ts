// Redis qua REST kiểu Upstash – chạy được ở middleware (edge) và Node.
// Trên VPS: Redis tự host + bộ chuyển REST (serverless-redis-http) → không phải đổi code.

export type RedisRest = { url: string; token: string };
export type RedisCommand = (string | number)[];

export function redisRest(): RedisRest | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

/** Gửi nhiều lệnh trong 1 request; lỗi / chậm quá timeoutMs → ném lỗi để nơi gọi tự quyết (fail-open) */
export async function redisPipeline(redis: RedisRest, commands: RedisCommand[], timeoutMs = 800): Promise<unknown[]> {
  const res = await fetch(`${redis.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${redis.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands.map((c) => c.map(String))),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis REST HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ result?: unknown; error?: string }>;
  return data.map((d) => {
    if (d.error) throw new Error(`Redis: ${d.error}`);
    return d.result;
  });
}
