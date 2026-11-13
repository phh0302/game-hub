import { ok, readJson } from "@/lib/api";
import { resolveServerProject, s1Handle } from "@/modules/platform/server";
import { serverCreateBoard, serverListBoards } from "@/modules/platform/server-service";

/** Server API – mọi bảng xếp hạng / giải đấu của game, kèm số điểm và số người chơi */
export async function GET(req: Request) {
  return s1Handle(async () => {
    const ctx = await resolveServerProject(req);
    return ok({ leaderboards: await serverListBoards(ctx) });
  });
}

/**
 * Server API – tạo bảng phụ / giải đấu có thời hạn:
 * { key, names: { vi, en? }, startsAt?, endsAt?, mirrorOf?: "default", order?, maxScore?, minScore?, maxScorePerSecond? }
 */
export async function POST(req: Request) {
  return s1Handle(async () => {
    const ctx = await resolveServerProject(req);
    return ok(await serverCreateBoard(ctx, await readJson(req)), { status: 201 });
  });
}
