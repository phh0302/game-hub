// Hàm thuần (không import alias / server-only) – chạy được ở middleware (edge) và trong unit test

/**
 * Giới hạn request cho mọi /api theo nhóm – lớp chặn đầu tiên, trước khi vào route / database.
 * Các route vẫn có giới hạn riêng chi tiết hơn (theo tài khoản, theo game…).
 * Đổi số ở đây là đổi chính sách cho cả hệ thống.
 */
export type TrafficGroup = "auth" | "write" | "read" | "platform" | "admin";

export const GROUP_LIMITS: Record<TrafficGroup, { limit: number; windowSec: number }> = {
  /** Lấy nonce / xác minh chữ ký / chơi khách – mục tiêu dò mật khẩu, spam tài khoản */
  auth: { limit: 30, windowSec: 60 },
  /** Ghi dữ liệu (POST/PUT/PATCH/DELETE) */
  write: { limit: 120, windowSec: 60 },
  /** Đọc (GET) */
  read: { limit: 300, windowSec: 60 },
  /** Client API / Server API của game ngoài hub (đã có giới hạn theo project) */
  platform: { limit: 900, windowSec: 60 },
  admin: { limit: 300, windowSec: 60 },
};

/** Gửi dồn dập: quá BURST_LIMIT request trong BURST_WINDOW_SEC giây → chặn IP BLOCK_SEC giây */
export const BURST_LIMIT = 150;
export const BURST_WINDOW_SEC = 10;
export const BLOCK_SEC = 15 * 60;

/** Body tối đa ở middleware (route JSON tự giới hạn 64 KB); trừ route nhận file */
export const MAX_BODY_BYTES = 64 * 1024;
const LARGE_BODY_PATHS = ["/api/v1/storage/local"];

/** Không áp giới hạn chung: cron có khóa riêng */
const SKIP_PREFIXES = ["/api/cron/"];

export function classifyRequest(pathname: string, method: string): TrafficGroup | null {
  if (!pathname.startsWith("/api/")) return null;
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (method === "OPTIONS" || method === "HEAD") return null;
  if (/^\/api\/(v1|p1)\/auth\//.test(pathname)) return "auth";
  if (pathname.startsWith("/api/v1/admin/")) return "admin";
  if (pathname.startsWith("/api/p1/") || pathname.startsWith("/api/s1/")) return "platform";
  return method === "GET" ? "read" : "write";
}

export function allowsLargeBody(pathname: string): boolean {
  return LARGE_BODY_PATHS.some((p) => pathname.startsWith(p));
}

/** Lưu tiến trình (saveState): dữ liệu ≤ 64KB UTF-8 nhưng gói trong JSON có thể dài hơn (escape) → nới cho riêng route này */
const STATE_BODY_BYTES = 256 * 1024;
const STATE_PATH = /^\/api\/(p1\/state|v1\/games\/[^/]+\/state)$/;

/** Body tối đa middleware cho phép với 1 đường dẫn */
export function maxBodyBytes(pathname: string): number {
  if (allowsLargeBody(pathname)) return Number.POSITIVE_INFINITY;
  if (STATE_PATH.test(pathname)) return STATE_BODY_BYTES;
  return MAX_BODY_BYTES;
}

/** Số giây tới hết cửa sổ cố định hiện tại (cho header Retry-After) */
export function secondsToWindowEnd(windowSec: number, nowMs = Date.now()): number {
  const windowMs = windowSec * 1000;
  return Math.max(1, Math.ceil((windowMs - (nowMs % windowMs)) / 1000));
}

/** Danh sách IP bỏ qua (vd máy chạy test tự động): "127.0.0.1,::1,unknown" */
export function parseExemptIps(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}
