import "server-only";
import { env } from "@/lib/env";

export const NONCE_TTL_MS = 5 * 60 * 1000; // nonce sống 5 phút
// Chuẩn EIP-4361 yêu cầu statement là ASCII, không dấu, không xuống dòng
export const SIWE_STATEMENT = "Sign in to Game Hub. This request will not trigger a blockchain transaction or cost any gas fees.";

const appUrl = new URL(env.NEXT_PUBLIC_APP_URL);

/**
 * Domain hợp lệ trong thông điệp SIWE.
 * Production: chỉ chấp nhận domain trong NEXT_PUBLIC_APP_URL.
 * Development: chấp nhận thêm host của request (vd: truy cập bằng IP LAN để test).
 */
export function expectedSiwe(req: Request) {
  const requestHost = req.headers.get("host");
  const allowDevHost = process.env.NODE_ENV !== "production" && requestHost;

  const domain = allowDevHost ? requestHost : appUrl.host;
  const uri = allowDevHost
    ? `${req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")}://${requestHost}`
    : appUrl.origin;

  return { domain, uri };
}
