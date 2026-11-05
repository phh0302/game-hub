import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/modules/auth/jwt";

/**
 * Chặn trang cần đăng nhập (/profile) và trang admin (/admin).
 * API tự kiểm tra quyền bên trong handler (requireUser / requireAdmin).
 */
export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = req.nextUrl;

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
  matcher: ["/profile/:path*", "/admin/:path*"],
};
