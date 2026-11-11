import { handle, ok } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import { getVisibleGame } from "@/modules/games/service";
import { listPublicBoards } from "@/modules/scores/boards-admin";

/** Các bảng xếp hạng của game: bảng chính + giải đấu đang / sắp / vừa diễn ra */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await params;
    const game = await getVisibleGame(slug);
    return ok({ leaderboards: await listPublicBoards(game.id, await resolveLocale(req)) });
  });
}
