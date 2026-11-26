import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/modules/auth/jwt";
import { isCrossSiteWrite } from "@/modules/auth/csrf";
import {
  BLOCK_SEC,
  classifyRequest,
  maxBodyBytes,
  parseExemptIps,
  type TrafficGroup,
} from "@/lib/traffic/limits";
import { guardRequest } from "@/lib/traffic/guard";
import { recordBlocked, recordHit } from "@/lib/traffic/recorder";
import { raiseAnomaly } from "@/lib/traffic/alerts";
import { normalizeRoute, parseSampleRate } from "@/lib/traffic/stats-keys";
import { pickRequestId, REQUEST_ID_HEADER } from "@/lib/log";

const LANDING_ORIGINS = new Set(["https://monlabs.fun", "https://www.monlabs.fun"]);

/**
 * 1. API: chặn request ghi dữ liệu đến từ web khác (CSRF).
 * 2. Trang: chặn /profile, /developer, /preview khi chưa đăng nhập; /admin khi không phải admin.
 * API tự kiểm tra quyền bên trong handler (requireUser / requireAdmin).
 */
export async function middleware(req: NextRequest, event: NextFetchEvent) {
  if (!req.nextUrl.pathname.startsWith("/api/")) return route(req, event, null);
  // API: mỗi request có mã riêng – gắn vào request (route ghi log / báo lỗi kèm mã) và response (người dùng báo lỗi kèm mã)
  // Chỉ tin x-vercel-id khi chạy trên Vercel (Vercel tự ghi đè header này; tự host thì client gửi được)
  const requestId = pickRequestId(process.env.VERCEL ? req.headers.get("x-vercel-id") : null);
  const res = await route(req, event, requestId);
  res.headers.set(REQUEST_ID_HEADER, requestId);
  return res;
}

async function route(req: NextRequest, event: NextFetchEvent, requestId: string | null): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // stats.monlabs.fun → trang theo dõi (chỉ admin, trang tự kiểm tra đăng nhập)
  if (isStatsHost(req) && pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/stats";
    return NextResponse.rewrite(url);
  }
  if (pathname === "/" || pathname.startsWith("/stats")) return NextResponse.next();

  // 0. API: lớp chặn chung (body quá lớn, IP bị chặn, vượt giới hạn nhóm) + lấy mẫu thống kê
  let forward: Headers | null = null;
  if (pathname.startsWith("/api/")) {
    const group = classifyRequest(pathname, req.method);
    const ip = requestIp(req);
    const stopped = group ? await trafficGuard(req, pathname, group, ip, event) : null;
    if (stopped) return stopped;
    forward = new Headers(req.headers);
    for (const h of ["x-mon-s", "x-mon-t", "x-mon-r", REQUEST_ID_HEADER]) forward.delete(h); // không tin header client tự gửi
    if (requestId) forward.set(REQUEST_ID_HEADER, requestId);
    forward.set("x-mon-t", String(Date.now()));
    forward.set("x-mon-r", normalizeRoute(pathname));
    if (group && Math.random() < SAMPLE_RATE) {
      forward.set("x-mon-s", "1");
      event.waitUntil(recordHit({ group, route: normalizeRoute(pathname), ip, rate: SAMPLE_RATE }));
    }
  }
  const pass = () => (forward ? NextResponse.next({ request: { headers: forward } }) : NextResponse.next());

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
    return pass();
  }

  // Trang giới thiệu monlabs.fun đọc tài khoản đang đăng nhập để hiện tên trên nút "Kết nối ví".
  // Chỉ GET /api/v1/me, chỉ từ domain của chính dự án (cùng site → trình duyệt gửi kèm cookie)
  if (pathname === "/api/v1/me" && req.method === "GET") {
    const origin = req.headers.get("origin");
    const res = pass();
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
    return pass();
  }

  // Sandbox chạy hoàn toàn trên trình duyệt, không đọc/ghi dữ liệu → ai cũng mở được
  if (pathname === "/developer/sandbox") return NextResponse.next();

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
  matcher: ["/", "/stats/:path*", "/api/:path*", "/profile/:path*", "/admin/:path*", "/developer/:path*", "/preview/:path*"],
};

const SAMPLE_RATE = parseSampleRate(process.env.TRAFFIC_SAMPLE_RATE);

function isStatsHost(req: NextRequest): boolean {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  return host.startsWith("stats.");
}

const EXEMPT_IPS = parseExemptIps(process.env.TRAFFIC_EXEMPT_IPS);

/** IP thật: proxy phía trước (Vercel / nginx) ghi đè x-forwarded-for → lấy phần tử đầu */
function requestIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

async function trafficGuard(
  req: NextRequest,
  pathname: string,
  group: TrafficGroup,
  ip: string,
  event: NextFetchEvent,
): Promise<NextResponse | null> {
  // Game ngoài hub đọc được lỗi (CORS) – các route khác cùng domain
  const origin = req.headers.get("origin");
  const cors: Record<string, string> =
    group === "platform" && origin && origin !== "null" ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBodyBytes(pathname)) {
    event.waitUntil(recordBlocked({ code: "PAYLOAD_TOO_LARGE" }));
    return NextResponse.json(
      { error: { code: "PAYLOAD_TOO_LARGE", message: "Dữ liệu gửi lên quá lớn" } },
      { status: 413, headers: cors },
    );
  }

  if (EXEMPT_IPS.has(ip)) return null;
  const result = await guardRequest(ip, group);
  if (result.ok) return null;
  event.waitUntil(recordBlocked({ code: result.code }));
  if (result.justBlocked) {
    event.waitUntil(
      raiseAnomaly("ip_blocked", `Đã chặn tạm IP ${ip} 15 phút vì gửi request dồn dập (nhóm ${group})`, {
        data: { ip, group },
        dedupeKey: `ip_blocked:${ip}`,
        dedupeSec: BLOCK_SEC,
      }),
    );
  }
  const message =
    result.code === "IP_BLOCKED"
      ? "Bạn gửi quá nhiều yêu cầu nên tạm bị chặn, thử lại sau ít phút"
      : "Bạn thao tác quá nhanh, thử lại sau ít phút";
  return NextResponse.json(
    { error: { code: result.code, message, retryAfter: result.retryAfter } },
    { status: 429, headers: { ...cors, "Retry-After": String(result.retryAfter), "Cache-Control": "no-store" } },
  );
}
