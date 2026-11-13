// Hàm thuần (không import alias / server-only) – dùng được trong unit test
import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const WEBHOOK_SIGNATURE_HEADER = "x-monlabs-signature";
/** Lịch gửi lại sau lần thất bại thứ n (giây): 1 phút, 5 phút, 30 phút, 2 giờ, 12 giờ */
export const WEBHOOK_RETRY_DELAYS = [60, 300, 1800, 7200, 43200];
export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_RETRY_DELAYS.length + 1;

/** Địa chỉ IP nội bộ / đặc biệt – không cho webhook gọi tới (chống SSRF) */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
  }
  return true; // không phải IP hợp lệ → coi như không an toàn
}

/**
 * Kiểm tra URL webhook: https, không user/pass, không trỏ vào localhost / IP nội bộ.
 * allowLocal: chỉ cho test tự động (biến môi trường WEBHOOK_ALLOW_PRIVATE=1).
 */
export function normalizeWebhookUrl(raw: string, allowLocal = false): string | null {
  if (raw.length > 500) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol !== "https:" && !(allowLocal && url.protocol === "http:")) return null;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const local = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal");
  if (!allowLocal && (local || (isIP(host) && isPrivateAddress(host)))) return null;
  url.hash = "";
  return url.toString();
}

/** Chữ ký: HMAC-SHA256(secret, "<timestamp>.<body>") → header "t=<timestamp>,v1=<hex>" */
export function signWebhook(secret: string, timestamp: number, body: string): string {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

/** Phía nhận (máy chủ của game) kiểm tra chữ ký – dùng trong docs và test. toleranceSeconds chống phát lại */
export function verifyWebhookSignature(
  secret: string,
  header: string | null | undefined,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  const parts = Object.fromEntries((header ?? "").split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1 || Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = signWebhook(secret, t, body).split("v1=")[1]!;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parts.v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Thời điểm gửi lại tiếp theo sau `attempts` lần đã thử (null = hết lượt) */
export function nextRetryAt(attempts: number, now = new Date()): Date | null {
  const delay = WEBHOOK_RETRY_DELAYS[attempts - 1];
  return delay === undefined ? null : new Date(now.getTime() + delay * 1000);
}
