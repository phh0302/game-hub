import { clientIp, handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeEvents } from "@/lib/game-events";
import { getVisibleGame } from "@/modules/games/service";
import { recordGameEvents } from "@/modules/analytics/events";

type Ctx = { params: Promise<{ slug: string }> };

/** Hub gửi lô sự kiện của game (GameHub.track) – không cần đăng nhập. Body: { events: [{ name, props? }] } */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    await rateLimit(`events:${clientIp(req)}`, 60, 60_000);
    const { slug } = await params;
    const game = await getVisibleGame(slug);
    const body = (await readJson(req)) as { events?: unknown } | null;
    return ok(await recordGameEvents(game.id, normalizeEvents(body?.events), "hub"));
  });
}
