import { ok } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import { listPublicBoards } from "@/modules/scores/boards-admin";
import { p1Handle, resolveProject } from "@/modules/platform/client";

/** Client API – bảng chính + các giải đấu đang hiển thị */
export async function GET(req: Request) {
  return p1Handle(req, async () => {
    const ctx = await resolveProject(req);
    return ok({ leaderboards: await listPublicBoards(ctx.game.id, await resolveLocale(req)) });
  });
}
