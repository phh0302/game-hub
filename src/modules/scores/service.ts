import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { toNumber } from "@/lib/format";
import { logEvent } from "@/modules/events/service";
import { getPlayableGame } from "@/modules/games/service";
import { readLeaderboardSettings } from "@/modules/games/settings";
import { boardKeySchema, getLeaderboardByKey, getUserRank, isBoardOpen } from "./leaderboard";
import { checkScore, type ScoreRuleError } from "./rules";

const REJECT_STATUS: Record<ScoreRuleError, number> = {
  SESSION_EXPIRED: 410,
  PLAY_TOO_SHORT: 400,
  SCORE_INVALID: 400,
  SCORE_TOO_FAST: 400,
};

const REJECT_MESSAGE: Record<ScoreRuleError, string> = {
  SESSION_EXPIRED: "Lượt chơi đã quá hạn",
  PLAY_TOO_SHORT: "Thời gian chơi quá ngắn, điểm không hợp lệ",
  SCORE_INVALID: "Điểm nằm ngoài mức cho phép",
  SCORE_TOO_FAST: "Tốc độ ghi điểm bất thường, điểm không hợp lệ",
};

export const submitScoreSchema = z.object({
  sessionId: z.string().min(1).max(50),
  score: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  /** Bảng xếp hạng nhận điểm, mặc định "default" */
  leaderboard: boardKeySchema,
});

/** Bắt đầu 1 lượt chơi – gắn với phiên bản game đang chạy */
export async function startSession(userId: string, slug: string) {
  const game = await getPlayableGame(slug);
  const session = await prisma.gameSession.create({
    data: { userId, gameId: game.id, gameVersionId: game.currentVersionId },
  });
  await logEvent({
    type: "session.start",
    userId,
    gameId: game.id,
    data: { sessionId: session.id, version: game.currentVersion?.version ?? null },
  });
  return { sessionId: session.id, startedAt: session.startedAt };
}

/**
 * Nộp điểm cho 1 lượt chơi.
 * Kiểm tra: lượt chơi thuộc đúng user + game, chưa nộp, thời gian chơi hợp lý,
 * bảng xếp hạng đang mở, điểm nằm trong giới hạn cho phép.
 */
export async function submitScore(userId: string, slug: string, input: z.infer<typeof submitScoreSchema>) {
  const game = await getPlayableGame(slug);
  const board = await getLeaderboardByKey(game.id, input.leaderboard);
  const now = new Date();

  if (!isBoardOpen(board, now)) {
    throw new ApiError(409, "LEADERBOARD_CLOSED", "Bảng xếp hạng không nhận điểm vào lúc này");
  }

  const session = await prisma.gameSession.findUnique({ where: { id: input.sessionId } });
  if (!session || session.userId !== userId || session.gameId !== game.id) {
    throw new ApiError(404, "SESSION_NOT_FOUND", "Không tìm thấy lượt chơi");
  }
  if (session.endedAt) {
    throw new ApiError(409, "SESSION_ENDED", "Lượt chơi này đã nộp điểm");
  }

  const durationSeconds = Math.floor((now.getTime() - session.startedAt.getTime()) / 1000);
  const limits = readLeaderboardSettings(board.settings);
  const rejected = checkScore(
    { score: input.score, durationSeconds },
    { ...game.parsedSettings, ...limits },
  );
  if (rejected) {
    // Ván bị từ chối là kết thúc luôn (không cho nộp lại cùng lượt chơi),
    // và ghi nhật ký để admin theo dõi gian lận / chỉnh ngưỡng cho hợp lý
    await prisma.gameSession.updateMany({ where: { id: session.id, endedAt: null }, data: { endedAt: now } });
    await logEvent({
      type: "score.rejected",
      userId,
      gameId: game.id,
      data: { sessionId: session.id, leaderboard: board.key, reason: rejected, value: input.score, durationSeconds },
    });
    throw new ApiError(REJECT_STATUS[rejected], rejected, REJECT_MESSAGE[rejected]);
  }

  const previous = await prisma.score.aggregate({
    where: { userId, leaderboardId: board.id },
    _max: { value: true },
    _min: { value: true },
  });
  const previousBest = board.order === "ASC" ? previous._min.value : previous._max.value;

  // Khóa lượt chơi (chỉ thành công 1 lần) rồi mới ghi điểm – chống nộp trùng khi gửi song song
  const score = await prisma.$transaction(async (tx) => {
    const closed = await tx.gameSession.updateMany({
      where: { id: session.id, endedAt: null },
      data: { endedAt: now },
    });
    if (closed.count !== 1) throw new ApiError(409, "SESSION_ENDED", "Lượt chơi này đã nộp điểm");

    return tx.score.create({
      data: {
        userId,
        gameId: game.id,
        leaderboardId: board.id,
        sessionId: session.id,
        value: BigInt(input.score),
        durationSeconds,
      },
    });
  });

  const value = toNumber(score.value);
  const isNewBest =
    previousBest === null ||
    (board.order === "ASC" ? value < toNumber(previousBest) : value > toNumber(previousBest));

  await logEvent({
    type: "score.submit",
    userId,
    gameId: game.id,
    data: { sessionId: session.id, leaderboard: board.key, value, durationSeconds },
  });

  const ranking = await getUserRank(board, userId, "all");
  return {
    score: { id: score.id, value, durationSeconds, leaderboard: board.key },
    isNewBest,
    best: ranking?.score ?? value,
    rank: ranking?.rank ?? null,
  };
}
