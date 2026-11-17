import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/modules/auth/jwt";
import { isCrossSiteWrite } from "@/modules/auth/csrf";
import { allowsLargeBody, classifyRequest, MAX_BODY_BYTES, parseExemptIps } from "@/lib/traffic/limits";
import { guardRequest } from "@/lib/traffic/guard";

const LANDING_ORIGINS = new Set(["https://monlabs.fun", "https://www.monlabs.fun"]);

/**
 * 1. API: chặn request ghi dữ liệu đến từ web khác (CSRF).
 * 2. Trang: chặn /profile, /developer, /preview khi chưa đăng nhập; /admin khi không phải admin.
 * API tự kiểm tra quyền bên trong handler (requireUser / requireAdmin).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 0. Lớp chặn chung cho mọi API: body quá lớn, IP đang bị chặn, vượt giới hạn nhóm
  if (pathname.startsWith("/api/")) {
    const stopped = await trafficGuard(req, pathname);
    if (stopped) return stopped;
  }

  // Client API cho game chạy trên domain riêng: không dùng cookie (key + token trong header)
  // → không cần chống CSRF; trả lời preflight CORS tại đây
  if (pathname.startsWith("/api/p1/")) {
    if (req.method === "OPTIONS") {
      const origin = req.headers.get("origin");
      return new NextResponse(null, {
        status: 204,
        headers: {
          ...(origin && origin !== "null" ? { "Access-Control-Allow-Origin": origin } : {}),
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "content-type, authorization, x-gamehub-key",
          "Access-Control-Max-Age": "600",
          Vary: "Origin",
        },
      });
    }
    return NextResponse.next();
  }

  // Trang giới thiệu monlabs.fun đọc tài khoản đang đăng nhập để hiện tên trên nút "Kết nối ví".
  // Chỉ GET /api/v1/me, chỉ từ domain của chính dự án (cùng site → trình duyệt gửi kèm cookie)
  if (pathname === "/api/v1/me" && req.method === "GET") {
    const origin = req.headers.get("origin");
    const res = NextResponse.next();
    if (origin && LANDING_ORIGINS.has(origin)) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }
    res.headers.set("Vary", "Origin");
    return res;
  }

  if (pathname.startsWith("/api/")) {
    const blocked = isCrossSiteWrite({
      method: req.method,
      origin: req.headers.get("origin"),
      host: req.headers.get("host"),
      forwardedHost: req.headers.get("x-forwarded-host"),
    });
    if (blocked) {
      return NextResponse.json(
        { error: { code: "CROSS_SITE_REQUEST", message: "Yêu cầu từ trang web khác bị chặn" } },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const needsAdmin = pathname.startsWith("/admin");
  const allowed = session && (!needsAdmin || session.role === "ADMIN");

  if (!allowed) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    url.searchParams.set("auth", needsAdmin && session ? "forbidden" : "required");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/profile/:path*", "/admin/:path*", "/developer/:path*", "/preview/:path*"],
};

const EXEMPT_IPS = parseExemptIps(process.env.TRAFFIC_EXEMPT_IPS);

/** IP thật: proxy phía trước (Vercel / nginx) ghi đè x-forwarded-for → lấy phần tử đầu */
function requestIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

async function trafficGuard(req: NextRequest, pathname: string): Promise<NextResponse | null> {
  const group = classifyRequest(pathname, req.method);
  if (!group) return null;
  // Game ngoài hub đọc được lỗi (CORS) – các route khác cùng domain
  const origin = req.headers.get("origin");
  const cors: Record<string, string> =
    group === "platform" && origin && origin !== "null" ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES && !allowsLargeBody(pathname)) {
    return NextResponse.json(
      { error: { code: "PAYLOAD_TOO_LARGE", message: "Dữ liệu gửi lên quá lớn" } },
      { status: 413, headers: cors },
    );
  }

  const ip = requestIp(req);
  if (EXEMPT_IPS.has(ip)) return null;
  const result = await guardRequest(ip, group);
  if (result.ok) return null;
  if (result.justBlocked) console.warn(`[traffic] Chặn tạm IP ${ip} (${group}) ${result.retryAfter}s`);
  const message =
    result.code === "IP_BLOCKED"
      ? "Bạn gửi quá nhiều yêu cầu nên tạm bị chặn, thử lại sau ít phút"
      : "Bạn thao tác quá nhanh, thử lại sau ít phút";
  return NextResponse.json(
    { error: { code: result.code, message, retryAfter: result.retryAfter } },
    { status: 429, headers: { ...cors, "Retry-After": String(result.retryAfter), "Cache-Control": "no-store" } },
  );
}
