import "server-only";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

/** Chặn người chơi đã bị cấm trong project này (developer cấm qua Server API) */
export async function assertNotBanned(gameId: string, userId: string) {
  const ban = await prisma.projectBan.findUnique({ where: { gameId_userId: { gameId, userId } } });
  if (ban) throw new ApiError(403, "PLAYER_BANNED", "Người chơi đã bị cấm trong game này");
}
