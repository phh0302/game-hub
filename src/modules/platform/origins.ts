// Hàm thuần (không import gì) – dùng được ở middleware (edge), server và unit test

/** Tối đa số domain khai báo cho 1 game */
export const MAX_ALLOWED_ORIGINS = 10;

/**
 * Chuẩn hóa 1 origin: "HTTPS://MyGame.io/" → "https://mygame.io".
 * Chỉ nhận http(s), không có đường dẫn / query / hash; http chỉ cho localhost (môi trường dev).
 * Trả về null nếu không hợp lệ.
 */
export function normalizeOrigin(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 200) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if ((url.pathname && url.pathname !== "/") || url.search || url.hash) return null;
  const host = url.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
  if (url.protocol === "http:" && !isLocal) return null;
  return url.origin.toLowerCase();
}

/** Origin của request có nằm trong danh sách domain đã khai báo không (so khớp tuyệt đối) */
export function isOriginAllowed(origin: string | null | undefined, allowed: readonly string[]): boolean {
  if (!origin || origin === "null") return false;
  const normalized = normalizeOrigin(origin);
  return normalized !== null && allowed.includes(normalized);
}

/**
 * Origin của trang gọi API. Trình duyệt KHÔNG gửi header Origin với GET cùng domain
 * (game đặt ngay trên domain của hub) → khi đó dựa vào Sec-Fetch-Site (trình duyệt tự đặt,
 * JS không sửa được) để lấy origin của chính request.
 */
export function requestOrigin(headers: { origin: string | null; secFetchSite: string | null }, requestUrl: string): string | null {
  if (headers.origin && headers.origin !== "null") return headers.origin;
  if (headers.secFetchSite === "same-origin") {
    try {
      return new URL(requestUrl).origin;
    } catch {
      return null;
    }
  }
  return null;
}
