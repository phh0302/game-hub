import { ok } from "@/lib/api";
import { getPlayer, p1Handle, resolveProject } from "@/modules/platform/client";
import { logoutPlayer } from "@/modules/platform/service";

/** Client API – đăng xuất: thu hồi token người chơi ngay */
export async function POST(req: Request) {
  return p1Handle(req, async () => {
    const ctx = await resolveProject(req);
    const player = await getPlayer(req, ctx);
    if (player) await logoutPlayer(player.sid, player.user.id);
    return ok({ success: true });
  });
}
