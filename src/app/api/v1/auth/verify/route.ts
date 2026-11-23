import { clientIp, handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { verifySchema, verifyWalletLogin } from "@/modules/auth/service";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/modules/auth/jwt";
import { createAuthSession } from "@/modules/auth/sessions";
import { toPublicUser } from "@/modules/users/dto";
import { parseRefCookie, REF_COOKIE } from "@/modules/referrals/codes";

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/** Bước 2 đăng nhập ví. Body: { message, signature } → set cookie phiên */
export async function POST(req: Request) {
  return handle(async () => {
    await rateLimit(`verify:${clientIp(req)}`, 20, 60_000);
    const input = verifySchema.parse(await readJson(req));
    // Link mời (?ref=) đã lưu vào cookie lúc mở trang → ghi nhận nếu đây là ví mới
    const referral = parseRefCookie(readCookie(req, REF_COOKIE));
    const user = await verifyWalletLogin(req, input, undefined, { referral });

    const sid = await createAuthSession(user.id, req);
    const token = await signSession({ sub: user.id, role: user.role, sid });
    const res = ok({ user: toPublicUser(user) });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    if (referral) res.cookies.set(REF_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  });
}
