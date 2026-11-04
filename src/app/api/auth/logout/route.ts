import { handle, ok } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/jwt";

export async function POST() {
  return handle(async () => {
    const res = ok({ success: true });
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return res;
  });
}
