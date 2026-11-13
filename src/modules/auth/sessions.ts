import "server-only";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api";
import { SESSION_MAX_AGE } from "./jwt";

/** Tạo phiên đăng nhập mới → id dùng làm jti trong JWT */
export async function createAuthSession(
  userId: string,
  req: Request,
  options: { gameId?: string; maxAgeSeconds?: number } = {},
): Promise<string> {
  const now = Date.now();
  const session = await prisma.authSession.create({
    data: {
      userId,
      gameId: options.gameId ?? null,
      expiresAt: new Date(now + (options.maxAgeSeconds ?? SESSION_MAX_AGE) * 1000),
      lastSeenAt: new Date(now),
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      ip: clientIp(req).slice(0, 64),
    },
  });
  // Dọn phiên đã hết hạn quá 30 ngày (giữ lại 1 thời gian để tra cứu khi cần)
  await prisma.authSession.deleteMany({ where: { expiresAt: { lt: new Date(now - 30 * 24 * 3600_000) } } });
  return session.id;
}

export async function revokeSession(sessionId: string, userId: string) {
  await prisma.authSession.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Đăng xuất mọi thiết bị / khi admin khóa tài khoản */
export async function revokeAllSessions(userId: string): Promise<number> {
  const res = await prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return res.count;
}

export async function countActiveSessions(userId: string): Promise<number> {
  return prisma.authSession.count({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } } });
}
