import "server-only";
import { GameStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { pickTranslation } from "@/lib/locale";
import { gameInclude, toGameDto } from "./dto";
import { readGameSettings } from "./settings";
import type { GameCreateInput, GameUpdateInput, VersionCreateInput, VersionReviewInput } from "./schemas";

/** Trạng thái người chơi nhìn thấy */
export const VISIBLE_STATUSES: GameStatus[] = [GameStatus.PUBLISHED, GameStatus.MAINTENANCE];

const OFFICIAL_STUDIO_SLUG = "game-hub";

// ───────────── Người chơi ─────────────

export async function listGames(locale: string, opts: { category?: string } = {}) {
  const games = await prisma.game.findMany({
    where: {
      status: { in: VISIBLE_STATUSES },
      deletedAt: null,
      ...(opts.category ? { categories: { some: { category: { slug: opts.category } } } } : {}),
    },
    include: gameInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return games.map((g) => toGameDto(g, locale));
}

export async function listCategories(locale: string) {
  const categories = await prisma.category.findMany({
    include: { translations: true },
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
  });
  return categories.map((c) => ({
    slug: c.slug,
    name: pickTranslation(c.translations, locale)?.name ?? c.slug,
  }));
}

/** Game người chơi được xem (không bị ẩn/xóa) */
export async function getVisibleGame(slug: string) {
  const game = await prisma.game.findUnique({ where: { slug }, include: gameInclude });
  if (!game || game.deletedAt || !VISIBLE_STATUSES.includes(game.status)) {
    throw new ApiError(404, "GAME_NOT_FOUND", "Không tìm thấy game");
  }
  return game;
}

/** Game đang mở để chơi: đã phát hành + có phiên bản được duyệt */
export async function getPlayableGame(slug: string) {
  const game = await getVisibleGame(slug);
  if (game.status !== GameStatus.PUBLISHED || !game.currentVersion) {
    throw new ApiError(423, "GAME_UNAVAILABLE", "Game đang bảo trì");
  }
  return { ...game, parsedSettings: readGameSettings(game.settings) };
}

// ───────────── Quản trị ─────────────

export async function adminListGames() {
  return prisma.game.findMany({
    where: { deletedAt: null },
    include: {
      ...gameInclude,
      versions: { orderBy: { createdAt: "desc" } },
      leaderboards: { where: { deletedAt: null } },
      _count: { select: { sessions: true, scores: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

async function getOfficialStudioId() {
  const studio = await prisma.studio.upsert({
    where: { slug: OFFICIAL_STUDIO_SLUG },
    update: {},
    create: { slug: OFFICIAL_STUDIO_SLUG, name: "Game Hub", isOfficial: true },
  });
  return studio.id;
}

async function resolveCategoryIds(slugs: string[] | undefined) {
  if (!slugs?.length) return [];
  const categories = await prisma.category.findMany({ where: { slug: { in: slugs } } });
  const missing = slugs.filter((s) => !categories.some((c) => c.slug === s));
  if (missing.length) {
    throw new ApiError(400, "CATEGORY_NOT_FOUND", `Không có thể loại: ${missing.join(", ")}`);
  }
  return categories.map((c) => c.id);
}

export async function adminCreateGame(input: GameCreateInput) {
  const [studioId, categoryIds] = await Promise.all([
    input.studioId ?? getOfficialStudioId(),
    resolveCategoryIds(input.categorySlugs),
  ]);
  const status = input.status ?? GameStatus.DRAFT;
  if (status === GameStatus.PUBLISHED) {
    // Game mới chưa có phiên bản nào → thêm phiên bản, duyệt, rồi mới phát hành
    throw new ApiError(409, "NO_APPROVED_VERSION", "Cần có phiên bản đã duyệt trước khi phát hành");
  }

  return prisma.game.create({
    data: {
      slug: input.slug,
      studioId,
      status,
      thumbnailKey: input.thumbnailKey ?? null,
      sortOrder: input.sortOrder ?? 0,
      settings: (input.settings ?? {}) as Prisma.InputJsonObject,
      translations: {
        create: input.translations.map((t) => ({ locale: t.locale, name: t.name, description: t.description ?? null })),
      },
      categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      leaderboards: {
        create: {
          key: "default",
          order: input.defaultLeaderboard?.order ?? "DESC",
          settings: (input.defaultLeaderboard?.settings ?? {}) as Prisma.InputJsonObject,
        },
      },
    },
    include: gameInclude,
  });
}

export async function adminUpdateGame(id: string, input: GameUpdateInput) {
  const game = await prisma.game.findUnique({ where: { id } });
  if (!game || game.deletedAt) throw new ApiError(404, "GAME_NOT_FOUND", "Không tìm thấy game");

  const categoryIds = input.categorySlugs ? await resolveCategoryIds(input.categorySlugs) : null;

  if (input.status === GameStatus.PUBLISHED && !game.currentVersionId) {
    throw new ApiError(409, "NO_APPROVED_VERSION", "Cần có phiên bản đã duyệt trước khi phát hành");
  }

  return prisma.$transaction(async (tx) => {
    if (input.translations) {
      for (const t of input.translations) {
        await tx.gameTranslation.upsert({
          where: { gameId_locale: { gameId: id, locale: t.locale } },
          create: { gameId: id, locale: t.locale, name: t.name, description: t.description ?? null },
          update: { name: t.name, description: t.description ?? null },
        });
      }
    }
    if (categoryIds) {
      await tx.gameCategory.deleteMany({ where: { gameId: id } });
      await tx.gameCategory.createMany({ data: categoryIds.map((categoryId) => ({ gameId: id, categoryId })) });
    }

    return tx.game.update({
      where: { id },
      data: {
        slug: input.slug,
        studioId: input.studioId,
        status: input.status,
        thumbnailKey: input.thumbnailKey,
        sortOrder: input.sortOrder,
        // Gộp với settings cũ để không mất các key khác
        settings: input.settings
          ? ({ ...(game.settings as Prisma.JsonObject), ...input.settings } as Prisma.InputJsonObject)
          : undefined,
        publishedAt: input.status === GameStatus.PUBLISHED && !game.publishedAt ? new Date() : undefined,
      },
      include: gameInclude,
    });
  });
}

/** Không xóa cứng: chuyển ARCHIVED + đánh dấu deletedAt, giữ lại lịch sử điểm */
export async function adminArchiveGame(id: string) {
  return prisma.game.update({
    where: { id },
    data: { status: GameStatus.ARCHIVED, deletedAt: new Date() },
  });
}

// ───────────── Phiên bản game ─────────────

export async function adminCreateVersion(gameId: string, input: VersionCreateInput, actorId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.deletedAt) throw new ApiError(404, "GAME_NOT_FOUND", "Không tìm thấy game");

  return prisma.gameVersion.create({
    data: {
      gameId,
      version: input.version,
      storageKey: input.storageKey,
      entryFile: input.entryFile,
      sizeBytes: input.sizeBytes,
      sdkVersion: input.sdkVersion,
      releaseNotes: input.releaseNotes,
      status: "PENDING_REVIEW",
      createdById: actorId,
    },
  });
}

export async function adminReviewVersion(
  gameId: string,
  versionId: string,
  input: VersionReviewInput,
  reviewerId: string,
) {
  const version = await prisma.gameVersion.findUnique({ where: { id: versionId } });
  if (!version || version.gameId !== gameId) throw new ApiError(404, "VERSION_NOT_FOUND", "Không tìm thấy phiên bản");
  if (input.status === "REJECTED" && version.id === (await currentVersionId(gameId))) {
    throw new ApiError(409, "VERSION_IN_USE", "Không thể từ chối phiên bản đang chạy");
  }

  return prisma.gameVersion.update({
    where: { id: versionId },
    data: { status: input.status, reviewNote: input.reviewNote, reviewedById: reviewerId, reviewedAt: new Date() },
  });
}

/** Đổi phiên bản đang chạy (cũng dùng để quay lại bản cũ) – chỉ nhận bản đã duyệt */
export async function adminActivateVersion(gameId: string, versionId: string) {
  const version = await prisma.gameVersion.findUnique({ where: { id: versionId } });
  if (!version || version.gameId !== gameId) throw new ApiError(404, "VERSION_NOT_FOUND", "Không tìm thấy phiên bản");
  if (version.status !== "APPROVED") {
    throw new ApiError(409, "VERSION_NOT_APPROVED", "Phiên bản chưa được duyệt");
  }
  return prisma.game.update({ where: { id: gameId }, data: { currentVersionId: versionId }, include: gameInclude });
}

async function currentVersionId(gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { currentVersionId: true } });
  return game?.currentVersionId ?? null;
}
