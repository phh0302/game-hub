// Hàm thuần (không import gì) – dùng được ở middleware (edge) và trong unit test

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Chống CSRF cho API ghi dữ liệu: request đổi dữ liệu mà có header Origin
 * thì Origin phải trùng host của hub. Trình duyệt luôn gửi Origin cho POST/PATCH/DELETE
 * từ web khác, nên web lạ không thể lợi dụng cookie đăng nhập của người chơi.
 * Request không có Origin (curl, server gọi server) không mang cookie của trình duyệt → cho qua.
 */
export function isCrossSiteWrite(req: {
  method: string;
  origin: string | null;
  host: string | null;
  forwardedHost?: string | null;
}): boolean {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return false;
  if (!req.origin) return false;
  if (req.origin === "null") return true; // trang sandbox / file:// gửi lên → chặn

  let originHost: string;
  try {
    originHost = new URL(req.origin).host.toLowerCase();
  } catch {
    return true;
  }
  const allowed = [req.host, req.forwardedHost]
    .flatMap((h) => (h ? h.split(",") : []))
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return !allowed.includes(originHost);
}
