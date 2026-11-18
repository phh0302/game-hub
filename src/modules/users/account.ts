import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { logEvent } from "@/modules/events/service";
import { storage } from "@/modules/storage";

/**
 * Vòng đời tài khoản: xóa tài khoản (người chơi tự xóa / admin xóa theo yêu cầu)
 * và gộp tài khoản khách vào tài khoản ví.
 */

/** Người chơi gõ chữ xác nhận trên giao diện; API luôn nhận chữ "DELETE" */
export const deleteAccountSchema = z.object({ confirm: z.literal("DELETE") });

/**
 * Xóa hẳn tài khoản: ví, tên, ảnh đại diện, phiên đăng nhập, lượt chơi, điểm, báo cáo, lệnh cấm.
 * Nhật ký sự kiện còn lại nhưng mất liên kết tới tài khoản (userId = null).
 * Không xóa được tài khoản admin hoặc chủ studio (chuyển quyền / xóa studio trước).
 */
export async function deleteUserAccount(userId: string, options: { byAdminId?: string } = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { identities: true } });
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản");
  if (user.role === "ADMIN") {
    throw new ApiError(409, "ADMIN_ACCOUNT", "Không xóa được tài khoản admin – hãy bỏ quyền admin trước");
  }
  const owned = await prisma.studioMember.count({ where: { userId, role: "OWNER", studio: { deletedAt: null } } });
  if (owned > 0) {
    throw new ApiError(409, "STUDIO_OWNER", "Bạn đang là chủ studio – hãy chuyển quyền chủ hoặc nhờ admin xóa studio trước");
  }

  if (user.avatarKey) await storage().delete(user.avatarKey).catch(() => undefined);
  const wallets = user.identities.filter((i) => i.provider === "WALLET").map((i) => i.providerUserId);
  await prisma.$transaction([
    prisma.authNonce.deleteMany({ where: { identifier: { in: wallets } } }),
    // Bảng đếm hạn mức không có khóa ngoại tới User
    prisma.studioMonthlyPlayer.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
  // Không ghi gì nhận ra được người đã xóa
  await logEvent({ type: "account.deleted", userId: options.byAdminId ?? null, data: { byAdmin: Boolean(options.byAdminId) } });
  return { deleted: true };
}

/**
 * Gộp tài khoản khách vào tài khoản ví đã có: chuyển lượt chơi, điểm, báo cáo, lệnh cấm,
 * số liệu hạn mức và nhật ký sang tài khoản ví rồi xóa tài khoản khách.
 * Lệnh cấm đi theo người chơi → không lách cấm bằng cách đổi tài khoản.
 */
export async function mergeGuestInto(guestId: string, targetId: string) {
  if (guestId === targetId) return;
  await prisma.$transaction(async (tx) => {
    const guest = await tx.user.findUnique({ where: { id: guestId } });
    if (!guest?.isGuest) return; // chỉ gộp tài khoản khách
    await tx.gameSession.updateMany({ where: { userId: guestId }, data: { userId: targetId } });
    await tx.score.updateMany({ where: { userId: guestId }, data: { userId: targetId } });
    // Tiến trình game: tài khoản đích đã có bản lưu của game nào thì giữ bản đó, còn lại chuyển từ khách sang
    const targetSaves = await tx.gameSave.findMany({ where: { userId: targetId }, select: { gameId: true } });
    await tx.gameSave.deleteMany({ where: { userId: guestId, gameId: { in: targetSaves.map((x) => x.gameId) } } });
    await tx.gameSave.updateMany({ where: { userId: guestId }, data: { userId: targetId } });
    await tx.gameReport.updateMany({ where: { reporterId: guestId }, data: { reporterId: targetId } });
    for (const ban of await tx.projectBan.findMany({ where: { userId: guestId } })) {
      await tx.projectBan.upsert({
        where: { gameId_userId: { gameId: ban.gameId, userId: targetId } },
        create: { gameId: ban.gameId, userId: targetId, reason: ban.reason },
        update: {},
      });
    }
    const months = await tx.studioMonthlyPlayer.findMany({ where: { userId: guestId } });
    if (months.length > 0) {
      await tx.studioMonthlyPlayer.createMany({
        data: months.map((m) => ({ studioId: m.studioId, month: m.month, userId: targetId })),
        skipDuplicates: true,
      });
      await tx.studioMonthlyPlayer.deleteMany({ where: { userId: guestId } });
    }
    await tx.event.updateMany({ where: { userId: guestId }, data: { userId: targetId } });
    await tx.user.delete({ where: { id: guestId } });
  });
  await logEvent({ type: "account.guest_merged", userId: targetId });
}
