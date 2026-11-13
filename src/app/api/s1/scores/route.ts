import { ok, readJson } from "@/lib/api";
import { resolveServerProject, s1Handle } from "@/modules/platform/server";
import { exportScores, exportScoresQuery, serverSubmitSchema, serverSubmitScore } from "@/modules/platform/server-service";

/** Server API – xuất điểm: ?leaderboard=default&since=ISO&cursor=&limit=100 */
export async function GET(req: Request) {
  return s1Handle(async () => {
    const ctx = await resolveServerProject(req);
    const query = exportScoresQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
    return ok(await exportScores(ctx, query));
  });
}

/**
 * Server API – máy chủ của game nộp điểm cho 1 lượt chơi: { sessionId, score, leaderboard? }.
 * Dùng cho chế độ "máy chủ xác nhận" (game tự kiểm tra ván chơi trước khi nộp).
 */
export async function POST(req: Request) {
  return s1Handle(async () => {
    const ctx = await resolveServerProject(req);
    const input = serverSubmitSchema.parse(await readJson(req));
    return ok(await serverSubmitScore(ctx, input), { status: 201 });
  });
}
