import { handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminCreateGame, adminListGames } from "@/modules/games/service";
import { gameCreateSchema } from "@/modules/games/schemas";

/** Admin: tất cả game (kể cả nháp, chờ duyệt) kèm phiên bản và bảng xếp hạng */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok({ games: await adminListGames() });
  });
}

/** Admin: tạo game mới (tự tạo bảng xếp hạng "default") */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const input = gameCreateSchema.parse(await readJson(req));
    return ok({ game: await adminCreateGame(input) }, { status: 201 });
  });
}
