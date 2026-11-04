import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { findVisibleGame } from "@/lib/games";
import { getLeaderboard, getUserRank, periodSchema } from "@/lib/leaderboard";

const limitSchema = z.coerce.number().int().min(1).max(100).default(50);

/**
 * Bảng xếp hạng: /api/games/2048/leaderboard?period=day|week|all&limit=50
 * Nếu đã đăng nhập, trả thêm `me` = hạng của chính mình.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await params;
    const search = new URL(req.url).searchParams;
    const period = periodSchema.parse(search.get("period") ?? undefined);
    const limit = limitSchema.parse(search.get("limit") ?? undefined);

    const game = await findVisibleGame(slug);
    const [entries, user] = await Promise.all([getLeaderboard(game.id, period, limit), getCurrentUser()]);
    const me = user ? await getUserRank(game.id, user.id, period) : null;

    return ok({ period, entries, me });
  });
}
