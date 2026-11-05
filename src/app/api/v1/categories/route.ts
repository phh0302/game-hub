import { handle, ok } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import { listCategories } from "@/modules/games/service";

export async function GET(req: Request) {
  return handle(async () => ok({ categories: await listCategories(await resolveLocale(req)) }));
}
