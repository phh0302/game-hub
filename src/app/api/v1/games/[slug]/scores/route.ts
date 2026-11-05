import { handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { submitScore, submitScoreSchema } from "@/modules/scores/service";

/** Nộp điểm. Body: { sessionId, score, leaderboard?: "default" } */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    rateLimit(`score:${user.id}`, 20, 60_000);
    const { slug } = await params;
    const input = submitScoreSchema.parse(await readJson(req));
    return ok(await submitScore(user.id, slug, input), { status: 201 });
  });
}
