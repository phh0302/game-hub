import { handle, ok } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import { getVisibleGame } from "@/modules/games/service";
import { toGameDto } from "@/modules/games/dto";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await params;
    const game = await getVisibleGame(slug);
    return ok({ game: toGameDto(game, await resolveLocale(req)) });
  });
}
