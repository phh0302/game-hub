import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import { getCurrentUser } from "@/modules/auth/session";
import { getVisibleGame } from "@/modules/games/service";
import {
  boardKeySchema,
  getLeaderboardByKey,
  getTopEntries,
  getUserRank,
  periodSchema,
  toBoardDto,
} from "@/modules/scores/leaderboard";

const querySchema = z.object({
  board: boardKeySchema,
  period: periodSchema,
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Bảng xếp hạng: /api/v1/games/2048/leaderboard?board=default&period=day|week|all&limit=50
 * Đã đăng nhập thì trả thêm `me` = hạng của chính mình.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await params;
    const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));

    const game = await getVisibleGame(slug);
    const board = await getLeaderboardByKey(game.id, query.board);
    const [entries, user, locale] = await Promise.all([
      getTopEntries(board, query.period, query.limit),
      getCurrentUser(),
      resolveLocale(req),
    ]);
    const me = user ? await getUserRank(board, user.id, query.period) : null;

    return ok({ leaderboard: toBoardDto(board, locale), period: query.period, entries, me });
  });
}
