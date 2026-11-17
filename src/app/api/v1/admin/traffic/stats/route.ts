import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { getStatsOverview, STATS_RANGES } from "@/modules/traffic/stats";
import { telegramStatus } from "@/lib/traffic/alerts";

export const dynamic = "force-dynamic";

const rangeSchema = z.enum(STATS_RANGES as [string, ...string[]]).default("24h");

/** Admin: số liệu lưu lượng API (trang stats.monlabs.fun) */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const range = rangeSchema.parse(new URL(req.url).searchParams.get("range") ?? undefined) as (typeof STATS_RANGES)[number];
    const [overview, telegram] = await Promise.all([getStatsOverview(range), telegramStatus()]);
    return ok({ ...overview, telegram, now: Date.now() });
  });
}
