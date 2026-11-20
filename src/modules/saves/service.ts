import "server-only";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { STATE_MAX_BYTES, utf8Bytes } from "@/lib/game-state";
import { getVisibleGame } from "@/modules/games/service";

/** Tiến trình đã lưu của người chơi trong game (chuỗi JSON) hoặc null */
export async function getSaveForGame(userId: string, gameId: string) {
  const save = await prisma.gameSave.findUnique({ where: { userId_gameId: { userId, gameId } } });
  return save ? { data: save.data, updatedAt: save.updatedAt } : { data: null, updatedAt: null };
}

/** Ghi đè tiến trình (bản sau thắng). data phải là JSON hợp lệ, tối đa 64KB UTF-8 */
export async function putSaveForGame(userId: string, gameId: string, data: unknown) {
  if (typeof data !== "string") throw new ApiError(400, "STATE_INVALID", "Dữ liệu tiến trình phải là chuỗi JSON");
  if (utf8Bytes(data) > STATE_MAX_BYTES) throw new ApiError(413, "STATE_TOO_LARGE", "Dữ liệu tiến trình tối đa 64KB");
  try {
    JSON.parse(data);
  } catch {
    throw new ApiError(400, "STATE_INVALID", "Dữ liệu tiến trình phải là JSON");
  }
  const save = await prisma.gameSave.upsert({
    where: { userId_gameId: { userId, gameId } },
    create: { userId, gameId, data },
    update: { data },
  });
  return { updatedAt: save.updatedAt };
}

/** Trên hub: tìm game theo slug (đang hiển thị) */
export async function getSave(userId: string, slug: string) {
  const game = await getVisibleGame(slug);
  return getSaveForGame(userId, game.id);
}

export async function putSave(userId: string, slug: string, data: string) {
  const game = await getVisibleGame(slug);
  return putSaveForGame(userId, game.id, data);
}
