import { z } from "zod";
import { ok } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import {
  boardKeySchema,
  getLeaderboardByKey,
  getTopEntries,
  getUserRank,
  periodSchema,
  toBoardDto,
} from "@/modules/scores/leaderboard";
import { getPlayer, p1Handle, resolveProject } from "@/modules/platform/client";

const querySchema = z.object({
  board: boardKeySchema,
  period: periodSchema,
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Client API – top người chơi: ?board=default&period=day|week|all&limit=50; có token thì trả thêm `me` */
export async function GET(req: Request) {
  return p1Handle(req, async () => {
    const ctx = await resolveProject(req);
    const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const board = await getLeaderboardByKey(ctx.game.id, query.board);
    const [entries, player, locale] = await Promise.all([
      getTopEntries(board, query.period, query.limit),
      getPlayer(req, ctx),
      resolveLocale(req),
    ]);
    const me = player ? await getUserRank(board, player.user.id, query.period) : null;
    return ok({ leaderboard: toBoardDto(board, locale), period: query.period, entries, me });
  });
}
