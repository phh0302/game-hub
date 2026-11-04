import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { SESSION_COOKIE, verifySession } from "./jwt";

/** Thông tin user an toàn để gửi xuống client */
export type PublicUser = Pick<User, "id" | "walletAddress" | "username" | "avatarUrl" | "role">;

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    walletAddress: user.walletAddress,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}

/**
 * User đang đăng nhập (đọc lại từ DB để luôn có username/role mới nhất).
 * Dùng cache() để trong 1 request chỉ query 1 lần.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.sub } });
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Bạn cần kết nối ví để tiếp tục");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Bạn không có quyền admin");
  return user;
}
