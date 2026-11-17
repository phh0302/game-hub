// Ghi số liệu truy cập (lấy mẫu) vào Redis – chạy được ở middleware (edge) và route (Node).
// Mọi lỗi đều bị nuốt: thống kê không bao giờ được làm hỏng request thật.
import { redisPipeline, redisRest, type RedisCommand } from "./redis";
import {
  hourIpKey,
  hourKey,
  hourOf,
  HOUR_TTL_SEC,
  latencyBucket,
  minuteIpKey,
  minuteKey,
  minuteOf,
  MINUTE_TTL_SEC,
  statusClass,
} from "./stats-keys";

const IP_SALT = process.env.TRAFFIC_IP_SALT || process.env.JWT_SECRET || "monlabs";

/** Mã hóa một chiều IP (10 ký tự hex) – thống kê không lưu IP gốc */
export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`${IP_SALT}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .slice(0, 5)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function both(now: number, build: (key: string, ttl: number) => RedisCommand[]): RedisCommand[] {
  return [...build(minuteKey(minuteOf(now)), MINUTE_TTL_SEC), ...build(hourKey(hourOf(now)), HOUR_TTL_SEC)];
}

async function run(commands: RedisCommand[]) {
  const redis = redisRest();
  if (!redis) return;
  try {
    await redisPipeline(redis, commands, 1500);
  } catch (err) {
    console.error("[traffic] Không ghi được thống kê", err);
  }
}

/** 1 request được lấy mẫu (ở middleware): đếm tổng, theo nhóm, theo route, theo IP (đã mã hóa) */
export async function recordHit(input: { group: string; route: string; ip: string; rate: number; now?: number }) {
  const now = input.now ?? Date.now();
  const ipHash = await hashIp(input.ip);
  const m = minuteOf(now);
  const h = hourOf(now);
  await run([
    ...both(now, (k, ttl) => [
      ["HINCRBY", k, "req", 1],
      ["HINCRBY", k, `g:${input.group}`, 1],
      ["HINCRBY", k, `r:${input.route}`, 1],
      ["HSET", k, "rate", input.rate],
      ["EXPIRE", k, ttl],
    ]),
    ["ZINCRBY", minuteIpKey(m), 1, ipHash],
    ["EXPIRE", minuteIpKey(m), MINUTE_TTL_SEC],
    ["ZINCRBY", hourIpKey(h), 1, ipHash],
    ["EXPIRE", hourIpKey(h), HOUR_TTL_SEC],
  ]);
}

/** Kết quả của request được lấy mẫu (ở route): mã trả về + thời gian xử lý */
export async function recordResult(input: { status: number; ms: number; now?: number }) {
  const now = input.now ?? Date.now();
  await run(
    both(now, (k, ttl) => [
      ["HINCRBY", k, `s:${statusClass(input.status)}`, 1],
      ["HINCRBY", k, `lat:${latencyBucket(input.ms)}`, 1],
      ["EXPIRE", k, ttl],
    ]),
  );
}

/** Request bị lớp chặn trả về 429 / 413 – đếm đủ (không lấy mẫu) vì đây là tín hiệu tấn công */
export async function recordBlocked(input: { code: string; now?: number }) {
  const now = input.now ?? Date.now();
  await run(both(now, (k, ttl) => [["HINCRBY", k, `blk:${input.code}`, 1], ["EXPIRE", k, ttl]]));
}
