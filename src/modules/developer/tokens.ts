import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { logEvent } from "@/modules/events/service";
import { userWithIdentities, type UserWithIdentities } from "@/modules/users/dto";

export const TOKEN_PREFIX = "mlb_";
const MAX_TOKENS = 10;

export const tokenCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  /** Số ngày hết hạn (bỏ trống = không hết hạn) */
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function looksLikeDevToken(value: string | null | undefined): value is string {
  return typeof value === "string" && /^mlb_[A-Za-z0-9_-]{32,64}$/.test(value);
}

export async function listTokens(userId: string) {
  const rows = await prisma.developerToken.findMany({ where: { userId, revokedAt: null }, orderBy: { createdAt: "desc" } });
  return rows.map((t) => ({ id: t.id, name: t.name, prefix: t.prefix, lastUsedAt: t.lastUsedAt, expiresAt: t.expiresAt, createdAt: t.createdAt }));
}

/** Tạo token – trả token gốc DUY NHẤT 1 lần, máy chủ chỉ giữ bản băm */
export async function createToken(userId: string, input: z.infer<typeof tokenCreateSchema>) {
  const count = await prisma.developerToken.count({ where: { userId, revokedAt: null } });
  if (count >= MAX_TOKENS) throw new ApiError(409, "TOO_MANY_TOKENS", `Tối đa ${MAX_TOKENS} token – thu hồi bớt token cũ`);
  const token = `${TOKEN_PREFIX}${randomBytes(30).toString("base64url")}`;
  const row = await prisma.developerToken.create({
    data: {
      userId,
      name: input.name,
      tokenHash: hashToken(token),
      prefix: token.slice(0, 12),
      expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null,
    },
  });
  await logEvent({ type: "devtoken.create", userId, data: { tokenId: row.id, name: row.name } });
  return { token, id: row.id, name: row.name, prefix: row.prefix, expiresAt: row.expiresAt };
}

export async function revokeToken(userId: string, id: string) {
  const res = await prisma.developerToken.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (res.count === 0) throw new ApiError(404, "TOKEN_NOT_FOUND", "Không tìm thấy token");
  await logEvent({ type: "devtoken.revoke", userId, data: { tokenId: id } });
}

/** Người dùng của token (null nếu sai / thu hồi / hết hạn / tài khoản bị khóa) */
export async function userFromDevToken(token: string): Promise<UserWithIdentities | null> {
  if (!looksLikeDevToken(token)) return null;
  const row = await prisma.developerToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: userWithIdentities } },
  });
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt <= new Date())) return null;
  if (row.user.deletedAt || row.user.suspendedAt || row.user.isGuest) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 5 * 60_000) {
    await prisma.developerToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return row.user;
}
