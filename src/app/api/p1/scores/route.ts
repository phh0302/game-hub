import { ok, readJson } from "@/lib/api";
import { submitScoreForGame, submitScoreSchema } from "@/modules/scores/service";
import { p1Handle, requirePlayer, resolveProject } from "@/modules/platform/client";

/**
 * Client API – nộp điểm cho 1 lượt chơi. Body: { sessionId, score, leaderboard? }.
 * Cùng luật chống gian lận như trên hub (thời gian máy chủ đo, ngưỡng điểm, tốc độ ghi điểm, 1 lượt nộp 1 lần).
 */
export async function POST(req: Request) {
  return p1Handle(req, async () => {
    const ctx = await resolveProject(req);
    const { user } = await requirePlayer(req, ctx);
    const input = submitScoreSchema.parse(await readJson(req));
    return ok(await submitScoreForGame(user.id, ctx.game, input), { status: 201 });
  });
}
