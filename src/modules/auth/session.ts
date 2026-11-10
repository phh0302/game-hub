import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { userWithIdentities, type UserWithIdentities } from "@/modules/users/dto";
import { SESSION_COOKIE, verifySession } from "./jwt";

/** Cập nhật "lần cuối hoạt động" của phiên tối đa 15 phút/lần (đỡ ghi DB mỗi request) */
const LAST_SEEN_INTERVAL_MS = 15 * 60_000;

/**
 * User đang đăng nhập (đọc lại từ DB để luôn có username/role mới nhất).
 * JWT hợp lệ CHƯA đủ: phiên (jti) phải còn trong bảng AuthSession, chưa bị thu hồi / hết hạn,
 * và tài khoản không bị xóa / khóa → đăng xuất và khóa tài khoản có hiệu lực ngay.
 * cache() → trong 1 request chỉ query 1 lần.
 */
export const getCurrentUser = cache(async (): Promise<UserWithIdentities | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session?.sid) return null; // JWT cũ (trước khi có bảng phiên) → đăng nhập lại
  const row = await prisma.authSession.findUnique({
    where: { id: session.sid },
    include: { user: { include: userWithIdentities } },
  });
  if (!row || row.userId !== session.sub || row.revokedAt || row.expiresAt <= new Date()) return null;
  const user = row.user;
  if (user.deletedAt || user.suspendedAt) return null;

  if (!row.lastSeenAt || Date.now() - row.lastSeenAt.getTime() > LAST_SEEN_INTERVAL_MS) {
    await prisma.authSession.update({ where: { id: row.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return user;
});

export async function requireUser(): Promise<UserWithIdentities> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Bạn cần kết nối ví để tiếp tục");
  return user;
}

/** Bắt buộc là tài khoản thật (không phải khách) – dùng cho nộp điểm, hồ sơ */
export async function requireRegisteredUser(): Promise<UserWithIdentities> {
  const user = await requireUser();
  if (user.isGuest) throw new ApiError(403, "GUEST_NOT_ALLOWED", "Hãy kết nối ví để dùng tính năng này");
  return user;
}

export async function requireAdmin(): Promise<UserWithIdentities> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Bạn không có quyền admin");
  return user;
}
