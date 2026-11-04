import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/session";
import { findPlayableGame } from "@/lib/games";

/** Bắt đầu 1 lượt chơi → trả sessionId để nộp điểm khi kết thúc */
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    rateLimit(`session:${user.id}`, 30, 60_000);

    const { slug } = await params;
    const game = await findPlayableGame(slug);

    const session = await prisma.gameSession.create({
      data: { userId: user.id, gameId: game.id },
    });

    return ok({ sessionId: session.id, startedAt: session.startedAt }, { status: 201 });
  });
}
