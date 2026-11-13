import { ok, readJson } from "@/lib/api";
import { verifySchema, verifyWalletLogin } from "@/modules/auth/service";
import { p1Handle, rateLimitIp, resolveProject } from "@/modules/platform/client";
import { issuePlayerToken, siweTarget } from "@/modules/platform/service";

/** Client API – bước 2 đăng nhập ví. Body: { message, signature } → { token, player } (không dùng cookie) */
export async function POST(req: Request) {
  return p1Handle(req, async () => {
    const ctx = await resolveProject(req);
    await rateLimitIp(req, "verify", 20, 60_000);
    const input = verifySchema.parse(await readJson(req));
    const user = await verifyWalletLogin(req, input, siweTarget(ctx));
    return ok(await issuePlayerToken(req, ctx, user));
  });
}
