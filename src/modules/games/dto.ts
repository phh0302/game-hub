import type { Prisma } from "@prisma/client";
import { assetUrl, gameEntryUrl } from "@/lib/assets";
import { pickTranslation } from "@/lib/locale";

export const gameInclude = {
  translations: true,
  categories: { include: { category: { include: { translations: true } } } },
  currentVersion: true,
  studio: { select: { id: true, slug: true, name: true, isOfficial: true } },
} satisfies Prisma.GameInclude;

export type GameWithRelations = Prisma.GameGetPayload<{ include: typeof gameInclude }>;

/** Game trả cho người chơi, đã chọn đúng ngôn ngữ */
export function toGameDto(game: GameWithRelations, locale: string) {
  const t = pickTranslation(game.translations, locale);
  return {
    id: game.id,
    slug: game.slug,
    name: t?.name ?? game.slug,
    description: t?.description ?? null,
    status: game.status,
    thumbnailUrl: assetUrl(game.thumbnailKey),
    /** URL nhúng iframe – null nếu chưa có phiên bản được duyệt */
    playUrl: game.currentVersion ? gameEntryUrl(game.currentVersion) : null,
    version: game.currentVersion?.version ?? null,
    sdkVersion: game.currentVersion?.sdkVersion ?? null,
    categories: game.categories.map(({ category }) => ({
      slug: category.slug,
      name: pickTranslation(category.translations, locale)?.name ?? category.slug,
    })),
    studio: game.studio,
    publishedAt: game.publishedAt,
  };
}

export type GameDto = ReturnType<typeof toGameDto>;
