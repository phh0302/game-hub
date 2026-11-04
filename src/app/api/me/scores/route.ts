import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

const gameFields = { id: true, slug: true, nameVi: true, nameEn: true, thumbnailUrl: true } as const;

/** Lịch sử điểm của user: điểm cao nhất từng game + 20 lượt gần nhất */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();

    const [bestGroups, recent] = await Promise.all([
      prisma.score.groupBy({
        by: ["gameId"],
        where: { userId: user.id },
        _max: { value: true },
        _count: { _all: true },
      }),
      prisma.score.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { game: { select: gameFields } },
      }),
    ]);

    const games = await prisma.game.findMany({
      where: { id: { in: bestGroups.map((g) => g.gameId) } },
      select: gameFields,
    });
    const gameById = new Map(games.map((g) => [g.id, g]));

    const bests = bestGroups
      .map((g) => ({
        game: gameById.get(g.gameId),
        bestScore: g._max.value ?? 0,
        plays: g._count._all,
      }))
      .filter((b) => b.game);

    return ok({
      bests,
      recent: recent.map((s) => ({
        id: s.id,
        value: s.value,
        durationSeconds: s.durationSeconds,
        createdAt: s.createdAt,
        game: s.game,
      })),
    });
  });
}
