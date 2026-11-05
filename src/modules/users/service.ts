import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assetUrl } from "@/lib/assets";
import { toNumber } from "@/lib/format";
import { pickTranslation } from "@/lib/locale";
import { userWithIdentities } from "./dto";
import { usernameSchema } from "./username";

export const updateProfileSchema = z.object({
  username: usernameSchema.nullable().optional(),
  /** Tạm thời nhận URL ảnh https; sau này thay bằng upload ảnh (lưu key) */
  avatarUrl: z.string().trim().url().startsWith("https://").max(500).nullable().optional(),
});

export async function updateProfile(userId: string, input: z.infer<typeof updateProfileSchema>) {
  return prisma.user.update({
    where: { id: userId },
    data: { username: input.username, avatarKey: input.avatarUrl },
    include: userWithIdentities,
  });
}

/** Thành tích: điểm tốt nhất trên từng bảng xếp hạng + 20 lượt gần nhất */
export async function getMyScores(userId: string, locale: string) {
  const [groups, recent] = await Promise.all([
    prisma.score.groupBy({
      by: ["leaderboardId"],
      where: { userId },
      _max: { value: true },
      _min: { value: true },
      _count: { _all: true },
    }),
    prisma.score.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        leaderboard: { select: { key: true } },
        game: { select: { slug: true, thumbnailKey: true, translations: true } },
      },
    }),
  ]);

  const boards = await prisma.leaderboard.findMany({
    where: { id: { in: groups.map((g) => g.leaderboardId) } },
    include: { game: { select: { slug: true, thumbnailKey: true, translations: true } } },
  });
  const boardById = new Map(boards.map((b) => [b.id, b]));

  const gameDto = (g: { slug: string; thumbnailKey: string | null; translations: { locale: string; name: string }[] }) => ({
    slug: g.slug,
    name: pickTranslation(g.translations, locale)?.name ?? g.slug,
    thumbnailUrl: assetUrl(g.thumbnailKey),
  });

  const bests = groups.flatMap((g) => {
    const board = boardById.get(g.leaderboardId);
    if (!board) return [];
    const best = board.order === "ASC" ? g._min.value : g._max.value;
    return [
      {
        game: gameDto(board.game),
        leaderboard: board.key,
        bestScore: best === null ? 0 : toNumber(best),
        plays: g._count._all,
      },
    ];
  });

  return {
    bests,
    recent: recent.map((s) => ({
      id: s.id,
      value: toNumber(s.value),
      durationSeconds: s.durationSeconds,
      createdAt: s.createdAt,
      leaderboard: s.leaderboard.key,
      game: gameDto(s.game),
    })),
  };
}
