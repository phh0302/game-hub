import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assetUrl } from "@/lib/assets";
import { toNumber } from "@/lib/format";
import { pickTranslation } from "@/lib/locale";
import { readLeaderboardSettings } from "@/modules/games/settings";
import { ApiError } from "@/lib/api";
import { isUploadKey } from "@/lib/assets";
import { storage } from "@/modules/storage";
import { isImageKeyOf } from "@/modules/storage/keys";
import { detectImageType } from "@/modules/uploads/image";
import { MAX_IMAGE_BYTES } from "@/modules/uploads/limits";
import { logEvent } from "@/modules/events/service";
import { userWithIdentities } from "./dto";
import { usernameSchema } from "./username";

export const updateProfileSchema = z.object({
  username: usernameSchema.nullable().optional(),
  /** Key ảnh đại diện vừa upload (POST /me/avatar-upload); null = bỏ ảnh; không gửi = giữ nguyên */
  avatarKey: z.string().trim().max(512).nullable().optional(),
});

/**
 * Ảnh đại diện phải là file chính user này vừa upload lên kho (không nhận link ngoài:
 * link ngoài để lộ IP người xem cho server lạ và có thể bị đổi nội dung sau khi duyệt).
 * Kiểm tra lại kích thước + chữ ký file thật sự là PNG/JPG/WEBP.
 */
async function verifyAvatar(userId: string, key: string) {
  if (!isImageKeyOf(key, userId)) throw new ApiError(400, "IMAGE_KEY_INVALID", "Ảnh không hợp lệ – hãy upload lại");
  const data = await storage().get(key);
  if (!data) throw new ApiError(400, "UPLOAD_NOT_FOUND", "Không tìm thấy ảnh vừa upload – hãy upload lại");
  if (data.byteLength > MAX_IMAGE_BYTES || !detectImageType(data)) {
    await storage().delete(key).catch(() => undefined);
    throw new ApiError(400, "IMAGE_INVALID", "File không phải ảnh PNG/JPG/WEBP hoặc lớn hơn 1MB");
  }
}

export async function updateProfile(userId: string, input: z.infer<typeof updateProfileSchema>) {
  const current = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarKey: true } });
  const changingAvatar = input.avatarKey !== undefined && input.avatarKey !== current.avatarKey;
  if (changingAvatar && input.avatarKey) await verifyAvatar(userId, input.avatarKey);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { username: input.username, ...(changingAvatar ? { avatarKey: input.avatarKey } : {}) },
    include: userWithIdentities,
  });

  // Dọn ảnh cũ (chỉ file của chính user, và không đang được dùng làm ảnh bìa game)
  const old = current.avatarKey;
  if (changingAvatar && old && isUploadKey(old) && isImageKeyOf(old, userId)) {
    const usedByGame = await prisma.game.count({ where: { thumbnailKey: old } });
    if (!usedByGame) await storage().delete(old).catch(() => undefined);
  }
  if (changingAvatar) await logEvent({ type: "user.avatar", userId, data: { removed: !input.avatarKey } });
  return user;
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
        leaderboard: { select: { key: true, settings: true } },
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
        format: readLeaderboardSettings(board.settings).format ?? "number",
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
      format: readLeaderboardSettings(s.leaderboard.settings).format ?? "number",
      game: gameDto(s.game),
    })),
  };
}
