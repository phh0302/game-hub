import { handle, ok, readJson } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { createStudioGame, listStudioGames, requireMyStudio } from "@/modules/developer/service";
import { devGameCreateSchema } from "@/modules/developer/schemas";

/** Game của studio tôi, kèm phiên bản và thống kê lượt chơi */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    return ok({ studio, games: await listStudioGames(studio.id, await resolveLocale(req)) });
  });
}

/** Tạo game mới (trạng thái Nháp) */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    rateLimit(`dev-game:${user.id}`, 20, 60 * 60_000);
    const input = devGameCreateSchema.parse(await readJson(req));
    return ok({ game: await createStudioGame(studio, user.id, input, await resolveLocale(req)) }, { status: 201 });
  });
}
