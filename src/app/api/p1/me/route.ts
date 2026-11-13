import { ok } from "@/lib/api";
import { getLeaderboardByKey, getUserRank } from "@/modules/scores/leaderboard";
import { p1Handle, requirePlayer, resolveProject } from "@/modules/platform/client";
import { playerDto } from "@/modules/platform/service";

/** Client API – người chơi hiện tại + điểm tốt nhất / hạng ở bảng chính */
export async function GET(req: Request) {
  return p1Handle(req, async () => {
    const ctx = await resolveProject(req);
    const { user } = await requirePlayer(req, ctx);
    const board = await getLeaderboardByKey(ctx.game.id, "default");
    return ok({ player: playerDto(user), best: await getUserRank(board, user.id, "all") });
  });
}
