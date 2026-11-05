import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import { listGames } from "@/modules/games/service";

const querySchema = z.object({ category: z.string().trim().max(50).optional() });

/** Danh sách game: /api/v1/games?category=puzzle&locale=en */
export async function GET(req: Request) {
  return handle(async () => {
    const { category } = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const games = await listGames(await resolveLocale(req), { category: category || undefined });
    return ok({ games });
  });
}
