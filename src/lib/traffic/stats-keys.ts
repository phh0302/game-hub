// Hàm thuần (không import alias / server-only) – dùng ở middleware (edge), route (Node) và unit test

/** Bucket thời gian xử lý (ms) – đủ để tính gần đúng p50 / p95 */
export const LATENCY_BUCKETS = [50, 100, 200, 500, 1000, 2000, 5000] as const;

export const MINUTE_TTL_SEC = 2 * 24 * 3600; // đủ cho xem 1 giờ / so sánh hôm qua
export const HOUR_TTL_SEC = 9 * 24 * 3600; // đủ cho xem 7 ngày

export function minuteOf(ms: number): number {
  return Math.floor(ms / 60_000);
}
export function hourOf(ms: number): number {
  return Math.floor(ms / 3_600_000);
}
export const minuteKey = (minute: number) => `traffic:m:${minute}`;
export const hourKey = (hour: number) => `traffic:h:${hour}`;
export const minuteIpKey = (minute: number) => `traffic:ipm:${minute}`;
export const hourIpKey = (hour: number) => `traffic:iph:${hour}`;

/** Bucket nhỏ nhất chứa được thời gian xử lý (lớn hơn bucket cuối → "inf") */
export function latencyBucket(ms: number): string {
  for (const b of LATENCY_BUCKETS) if (ms <= b) return String(b);
  return "inf";
}

/** p (0–1) gần đúng từ histogram { "50": n, "100": n, …, "inf": n } → biên trên của bucket chứa p */
export function percentileFromHistogram(hist: Record<string, number>, p: number): number | null {
  const order = [...LATENCY_BUCKETS.map(String), "inf"];
  const total = order.reduce((a, k) => a + (hist[k] ?? 0), 0);
  if (total === 0) return null;
  let acc = 0;
  for (const k of order) {
    acc += hist[k] ?? 0;
    if (acc >= p * total) return k === "inf" ? LATENCY_BUCKETS[LATENCY_BUCKETS.length - 1]! * 2 : Number(k);
  }
  return null;
}

export function statusClass(status: number): "2xx" | "3xx" | "4xx" | "5xx" {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  return "2xx";
}

const ID_LIKE = /^(c[a-z0-9]{20,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|[0-9a-f]{16,}|0x[0-9a-fA-F]{40})$/;

/** Gom đường dẫn về dạng route: id → :id, slug game → :slug (để đếm theo route, không theo từng game) */
export function normalizeRoute(pathname: string): string {
  const parts = pathname.split("/").map((seg, i, all) => {
    if (!seg) return seg;
    // /api/v1/games/<slug>/... (slug có thể là số, vd 2048)
    if (i === 4 && all[1] === "api" && all[3] === "games") return ":slug";
    if (ID_LIKE.test(seg)) return ":id";
    return seg;
  });
  return parts.join("/").slice(0, 120) || "/";
}

/** Tỷ lệ lấy mẫu từ biến môi trường (0 < r ≤ 1), mặc định 0.2 */
export function parseSampleRate(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.2;
}
