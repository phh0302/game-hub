import { cookies } from "next/headers";
import { handle, ok } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions, verifySession } from "@/modules/auth/jwt";
import { revokeAllSessions, revokeSession } from "@/modules/auth/sessions";
import { logEvent } from "@/modules/events/service";

/** Đăng xuất: thu hồi phiên hiện tại (`?all=1` → thu hồi mọi phiên của tài khoản – đăng xuất mọi thiết bị) */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
    const all = new URL(req.url).searchParams.get("all") === "1";
    let revoked = 0;
    if (session?.sid) {
      if (all) revoked = await revokeAllSessions(session.sub);
      else await revokeSession(session.sid, session.sub);
      if (all) await logEvent({ type: "auth.logout_all", userId: session.sub, data: { revoked } });
    }
    const res = ok({ success: true, revoked });
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return res;
  });
}
