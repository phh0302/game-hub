import { handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { getInviteInfo, listInvitees } from "@/modules/referrals/service";

/**
 * Mã mời của mình + số bạn đã mời. ?game=<slug> → thêm số bạn vào qua game đó; ?list=1 → danh sách bạn đã mời.
 * Link mời: https://play.monlabs.fun/games/<slug>?ref=<code>
 */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const url = new URL(req.url);
    const game = url.searchParams.get("game");
    const info = await getInviteInfo(user.id, game && /^[a-z0-9-]{1,63}$/.test(game) ? game : null);
    const invitees = url.searchParams.get("list") === "1" ? await listInvitees(user.id) : undefined;
    return ok({ ...info, ...(invitees ? { invitees } : {}) });
  });
}
