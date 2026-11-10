import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { displayName } from "@/lib/format";
import { logEvent } from "@/modules/events/service";
import { countActiveSessions, revokeAllSessions } from "@/modules/auth/sessions";
import { primaryWallet, userWithIdentities, type UserWithIdentities } from "./dto";

export const userLookupSchema = z.object({ q: z.string().trim().min(2).max(64) });

export const userSuspendSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

async function toAdminUser(user: UserWithIdentities) {
  const wallet = primaryWallet(user);
  const [activeSessions, scores] = await Promise.all([
    countActiveSessions(user.id),
    prisma.score.count({ where: { userId: user.id } }),
  ]);
  return {
    id: user.id,
    displayName: displayName({ id: user.id, username: user.username, walletAddress: wallet }),
    username: user.username,
    walletAddress: wallet,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    suspendedAt: user.suspendedAt,
    suspendReason: user.suspendReason,
    activeSessions,
    scores,
  };
}

/** Tìm user theo địa chỉ ví (đầy đủ) hoặc tên người dùng */
export async function adminFindUser(q: string) {
  const query = q.trim().toLowerCase();
  const user = /^0x[0-9a-f]{40}$/.test(query)
    ? (
        await prisma.authIdentity.findUnique({
          where: { provider_providerUserId: { provider: "WALLET", providerUserId: query } },
          include: { user: { include: userWithIdentities } },
        })
      )?.user
    : await prisma.user.findUnique({ where: { username: query }, include: userWithIdentities });
  if (!user || user.deletedAt) throw new ApiError(404, "USER_NOT_FOUND", "Không tìm thấy người dùng");
  return toAdminUser(user);
}

/** Khóa / mở khóa tài khoản. Khóa → thu hồi mọi phiên đăng nhập + ẩn khỏi bảng xếp hạng ngay */
export async function adminSetSuspended(adminId: string, userId: string, input: z.infer<typeof userSuspendSchema>) {
  if (userId === adminId) throw new ApiError(400, "CANNOT_SUSPEND_SELF", "Không thể tự khóa tài khoản của mình");
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) throw new ApiError(404, "USER_NOT_FOUND", "Không tìm thấy người dùng");
  if (target.role === "ADMIN") throw new ApiError(403, "CANNOT_SUSPEND_ADMIN", "Không thể khóa tài khoản admin");

  const user = await prisma.user.update({
    where: { id: userId },
    data: input.suspended
      ? { suspendedAt: target.suspendedAt ?? new Date(), suspendReason: input.reason || null }
      : { suspendedAt: null, suspendReason: null },
    include: userWithIdentities,
  });
  const revoked = input.suspended ? await revokeAllSessions(userId) : 0;
  await logEvent({
    type: input.suspended ? "user.suspend" : "user.unsuspend",
    userId: adminId,
    data: { targetUserId: userId, reason: input.reason ?? null, revokedSessions: revoked },
  });
  return toAdminUser(user);
}
