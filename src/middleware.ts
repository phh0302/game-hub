import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/modules/auth/jwt";
import { isCrossSiteWrite } from "@/modules/auth/csrf";

/**
 * 1. API: chặn request ghi dữ liệu đến từ web khác (CSRF).
 * 2. Trang: chặn /profile khi chưa đăng nhập, /admin khi không phải admin.
 * API tự kiểm tra quyền bên trong handler (requireUser / requireAdmin).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
  matcher: ["/api/:path*", "/profile/:path*", "/admin/:path*"],
};
