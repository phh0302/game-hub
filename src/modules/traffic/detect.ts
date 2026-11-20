import "server-only";
import { raiseAnomaly } from "@/lib/traffic/alerts";
import { redisPipeline, redisRest } from "@/lib/traffic/redis";
import { hourKey, hourOf, minuteIpKey, minuteKey, minuteOf } from "@/lib/traffic/stats-keys";

/** Ngưỡng phát hiện bất thường (5 phút gần nhất) */
export const THRESHOLDS = {
  /** Lưu lượng ước tính tối thiểu mới xét "tăng đột biến" */
  spikeMinRequests: 300,
  /** Gấp bao nhiêu lần mức trung bình 24 giờ trước */
  spikeFactor: 3,
  errorRate: 0.05,
  errorMinSamples: 20,
  ipShare: 0.5,
  ipMinRequests: 100,
  blockedRequests: 100,
};

export type Bucket = Record<string, number>;

/** HGETALL dạng mảng phẳng [k, v, k, v] → object số */
export function toBucket(flat: unknown): Bucket {
  const out: Bucket = {};
  if (!Array.isArray(flat)) return out;
  for (let i = 0; i + 1 < flat.length; i += 2) out[String(flat[i])] = Number(flat[i + 1]) || 0;
  return out;
}

/** Số ước tính = số lấy mẫu / tỷ lệ lấy mẫu của bucket đó */
export function est(b: Bucket, field: string): number {
  const rate = b.rate && b.rate > 0 ? b.rate : 1;
  return (b[field] ?? 0) / rate;
}

/** Chỉ 1 server chạy phát hiện mỗi phút (khóa trong Redis) */
export async function maybeDetect(now = Date.now()) {
  const redis = redisRest();
  if (!redis) return;
  try {
    const [lock] = (await redisPipeline(redis, [["SET", `traffic:detect:${minuteOf(now)}`, 1, "NX", "EX", 120]])) as [
      string | null,
    ];
    if (lock !== "OK") return;
    await detect(now);
    // Cùng nhịp tối đa 1 lần / phút: chạy kiểm tra trạng thái nếu lịch GitHub bỏ lượt
    const { checkIfStale } = await import("@/modules/status/uptime");
    await checkIfStale(now);
  } catch (err) {
    console.error("[traffic] Phát hiện bất thường lỗi", err);
  }
}

export async function detect(now = Date.now()) {
  const redis = redisRest();
  if (!redis) return [];
  const m = minuteOf(now);
  const h = hourOf(now);
  const minutes = [1, 2, 3, 4, 5].map((i) => m - i); // 5 phút đã trọn
  const hours = Array.from({ length: 24 }, (_, i) => h - 1 - i);
  const res = await redisPipeline(redis, [
    ...minutes.map((x) => ["HGETALL", minuteKey(x)]),
    ...hours.map((x) => ["HGETALL", hourKey(x)]),
    ...minutes.map((x) => ["ZREVRANGE", minuteIpKey(x), 0, 4, "WITHSCORES"]),
  ]);
  const mins = res.slice(0, 5).map(toBucket);
  const hrs = res.slice(5, 29).map(toBucket);
  const ipLists = res.slice(29) as string[][];

  const req5 = mins.reduce((a, b) => a + est(b, "req"), 0);
  const raised = [];

  // 1. Lưu lượng tăng đột biến so với trung bình / phút của 24 giờ trước
  const histHours = hrs.filter((b) => (b.req ?? 0) > 0);
  const basePerMin = histHours.length > 0 ? histHours.reduce((a, b) => a + est(b, "req"), 0) / (histHours.length * 60) : 0;
  const spikeAt = Math.max(THRESHOLDS.spikeMinRequests, basePerMin * 5 * THRESHOLDS.spikeFactor);
  if (req5 > spikeAt) {
    raised.push(
      await raiseAnomaly(
        "traffic_spike",
        `Lưu lượng tăng đột biến: ~${Math.round(req5)} request / 5 phút (bình thường ~${Math.round(basePerMin * 5)})`,
        { data: { req5: Math.round(req5), base5: Math.round(basePerMin * 5) }, now },
      ),
    );
  }

  // 2. Tỷ lệ lỗi máy chủ
  const sum = (f: string) => mins.reduce((a, b) => a + (b[f] ?? 0), 0);
  const results = sum("s:2xx") + sum("s:3xx") + sum("s:4xx") + sum("s:5xx");
  if (results >= THRESHOLDS.errorMinSamples && sum("s:5xx") / results >= THRESHOLDS.errorRate) {
    const pct = Math.round((sum("s:5xx") / results) * 100);
    raised.push(await raiseAnomaly("error_rate", `Lỗi máy chủ (5xx) cao: ${pct}% request trong 5 phút`, { data: { pct }, now }));
  }

  // 3. Một IP chiếm phần lớn lưu lượng
  const perIp = new Map<string, number>();
  for (const flat of ipLists) {
    for (let i = 0; i + 1 < (flat?.length ?? 0); i += 2) perIp.set(flat[i]!, (perIp.get(flat[i]!) ?? 0) + Number(flat[i + 1]));
  }
  const sampled5 = sum("req");
  const [topIp, topCount] = [...perIp.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  if (topIp && sampled5 > 0 && topCount / sampled5 >= THRESHOLDS.ipShare && req5 >= THRESHOLDS.ipMinRequests) {
    const pct = Math.round((topCount / sampled5) * 100);
    raised.push(
      await raiseAnomaly("ip_dominant", `1 IP (mã ${topIp}) chiếm ${pct}% lưu lượng 5 phút qua`, {
        data: { ipHash: topIp, pct },
        dedupeKey: `ip_dominant:${topIp}`,
        now,
      }),
    );
  }

  // 4. Nhiều request bị chặn (429 / 413) – đếm đủ, không lấy mẫu
  const blocked = sum("blk:RATE_LIMITED") + sum("blk:IP_BLOCKED") + sum("blk:PAYLOAD_TOO_LARGE");
  if (blocked >= THRESHOLDS.blockedRequests) {
    raised.push(
      await raiseAnomaly("rate_limited_spike", `${blocked} request bị chặn trong 5 phút (có thể đang bị tấn công)`, {
        data: { blocked },
        now,
      }),
    );
  }
  return raised;
}
