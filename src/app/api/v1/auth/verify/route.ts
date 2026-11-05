import { clientIp, handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { verifySchema, verifyWalletLogin } from "@/modules/auth/service";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/modules/auth/jwt";
import { toPublicUser } from "@/modules/users/dto";

/** Bước 2 đăng nhập ví. Body: { message, signature } → set cookie phiên */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(`verify:${clientIp(req)}`, 20, 60_000);
    const input = verifySchema.parse(await readJson(req));
    const user = await verifyWalletLogin(req, input);

    const token = await signSession({ sub: user.id, role: user.role });
    const res = ok({ user: toPublicUser(user) });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  });
}
