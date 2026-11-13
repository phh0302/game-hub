import { ok } from "@/lib/api";
import { startSessionForGame } from "@/modules/scores/service";
import { p1Handle, requirePlayer, resolveProject } from "@/modules/platform/client";

/** Client API – bắt đầu 1 lượt chơi (máy chủ bắt đầu tính giờ) → { sessionId } */
export async function POST(req: Request) {
  return p1Handle(req, async () => {
    const ctx = await resolveProject(req);
    const { user } = await requirePlayer(req, ctx);
    return ok(await startSessionForGame(user.id, ctx.game, "api"), { status: 201 });
  });
}
