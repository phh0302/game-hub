import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/session";
import { findPlayableGame } from "@/lib/games";
import { getUserRank } from "@/lib/leaderboard";

const bodySchema = z.object({
  sessionId: z.string().min(1).max(50),
  score: z.number().int().min(0).max(2_147_483_647),
});

// Lượt chơi bắt đầu quá 6 tiếng thì không nhận điểm nữa
const MAX_SESSION_AGE_SECONDS = 6 * 60 * 60;

/**
 * Nộp điểm cho 1 lượt chơi. Body: { sessionId, score }
 * Kiểm tra: session thuộc đúng user + game, chưa nộp, thời gian chơi hợp lý, điểm không vượt maxScore.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    rateLimit(`score:${user.id}`, 20, 60_000);

    const { slug } = await params;
    const game = await findPlayableGame(slug);
    const body = bodySchema.parse(await readJson(req));

    const session = await prisma.gameSession.findUnique({ where: { id: body.sessionId } });
    if (!session || session.userId !== user.id || session.gameId !== game.id) {
      throw new ApiError(404, "SESSION_NOT_FOUND", "Không tìm thấy lượt chơi");
    }
    if (session.endedAt) {
      throw new ApiError(409, "SESSION_ENDED", "Lượt chơi này đã nộp điểm");
    }

    const now = new Date();
    const durationSeconds = Math.floor((now.getTime() - session.startedAt.getTime()) / 1000);

    if (durationSeconds > MAX_SESSION_AGE_SECONDS) {
      throw new ApiError(410, "SESSION_EXPIRED", "Lượt chơi đã quá hạn");
    }
    if (durationSeconds < game.minPlaySeconds) {
      throw new ApiError(400, "PLAY_TOO_SHORT", "Thời gian chơi quá ngắn, điểm không hợp lệ");
    }
    if (game.maxScore !== null && body.score > game.maxScore) {
      throw new ApiError(400, "SCORE_INVALID", "Điểm vượt mức cho phép");
    }

    const previousBest = await prisma.score.aggregate({
      where: { userId: user.id, gameId: game.id },
      _max: { value: true },
    });

    // Khóa session (chỉ thành công 1 lần) rồi mới ghi điểm – chống nộp trùng khi gửi song song
    const score = await prisma.$transaction(async (tx) => {
      const closed = await tx.gameSession.updateMany({
        where: { id: session.id, endedAt: null },
        data: { endedAt: now },
      });
      if (closed.count !== 1) {
        throw new ApiError(409, "SESSION_ENDED", "Lượt chơi này đã nộp điểm");
      }
      return tx.score.create({
        data: {
          userId: user.id,
          gameId: game.id,
          sessionId: session.id,
          value: body.score,
          durationSeconds,
        },
      });
    });

    const oldBest = previousBest._max.value;
    const ranking = await getUserRank(game.id, user.id, "all");

    return ok(
      {
        score: { id: score.id, value: score.value, durationSeconds },
        isNewBest: oldBest === null || score.value > oldBest,
        best: ranking?.score ?? score.value,
        rank: ranking?.rank ?? null,
      },
      { status: 201 },
    );
  });
}
