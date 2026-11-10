import { handle, ok } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import { requireAdmin } from "@/modules/auth/session";
import { adminStats, statsQuerySchema } from "@/modules/stats/service";

/** Admin: thống kê ?days=7|30|90 */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { days } = statsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return ok(await adminStats(days, await resolveLocale(req)));
  });
}
