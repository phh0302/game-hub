import { clientIp, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeEvents } from "@/lib/game-events";
import { p1Handle, resolveProject } from "@/modules/platform/client";
import { recordGameEvents } from "@/modules/analytics/events";

/** Client API – lô sự kiện của game chạy ngoài hub (GameHub.track). Không cần người chơi đăng nhập */
export async function POST(req: Request) {
  return p1Handle(req, async () => {
    const ctx = await resolveProject(req);
    await rateLimit(`p1-events:${clientIp(req)}`, 60, 60_000);
    const body = (await readJson(req)) as { events?: unknown } | null;
    return ok(await recordGameEvents(ctx.game.id, normalizeEvents(body?.events), "api"));
  });
}
