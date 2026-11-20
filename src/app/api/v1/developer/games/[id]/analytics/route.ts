import { handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { findStudioGame, requireMyStudio } from "@/modules/developer/service";
import { getGameEventStats } from "@/modules/analytics/events";

type Ctx = { params: Promise<{ id: string }> };

/** Developer: sự kiện game (GameHub.track) – ?days=7|30 */
export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const { id } = await params;
    const studio = await requireMyStudio(user.id);
    const game = await findStudioGame(studio.id, id);
    const days = new URL(req.url).searchParams.get("days") === "30" ? 30 : 7;
    return ok(await getGameEventStats(game.id, days));
  });
}
