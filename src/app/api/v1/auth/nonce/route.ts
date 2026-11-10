import { clientIp, handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { challengeSchema, createWalletChallenge } from "@/modules/auth/service";

/** Bước 1 đăng nhập ví. Body: { address: "0x...", chainId: 1 } → { message } để ví ký */
export async function POST(req: Request) {
  return handle(async () => {
    await rateLimit(`nonce:${clientIp(req)}`, 20, 60_000);
    const input = challengeSchema.parse(await readJson(req));
    const message = await createWalletChallenge(req, input);
    return ok({ message });
  });
}
