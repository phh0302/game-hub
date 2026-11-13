import { ok, readJson } from "@/lib/api";
import { challengeSchema, createWalletChallenge } from "@/modules/auth/service";
import { p1Handle, rateLimitIp, resolveProject } from "@/modules/platform/client";
import { siweTarget } from "@/modules/platform/service";

/** Client API – bước 1 đăng nhập ví: thông điệp SIWE ghi đúng domain của game. Body: { address, chainId } */
export async function POST(req: Request) {
  return p1Handle(req, async () => {
    const ctx = await resolveProject(req);
    await rateLimitIp(req, "nonce", 20, 60_000);
    const input = challengeSchema.parse(await readJson(req));
    return ok({ message: await createWalletChallenge(req, input, siweTarget(ctx)) });
  });
}
