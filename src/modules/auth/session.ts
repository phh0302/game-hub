import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { userWithIdentities, type UserWithIdentities } from "@/modules/users/dto";
import { SESSION_COOKIE, verifySession } from "./jwt";

/**
 * User đang đăng nhập (đọc lại từ DB để luôn có username/role mới nhất).
 * cache() → trong 1 request chỉ query 1 lần.
 */
export const getCurrentUser = cache(async (): Promise<UserWithIdentities | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub }, include: userWithIdentities });
  return user && !user.deletedAt ? user : null;
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
