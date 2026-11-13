import "server-only";
import { prisma } from "@/lib/prisma";
import { pickTranslation } from "@/lib/locale";
import { logEvent } from "@/modules/events/service";
import { createAuthSession, revokeSession } from "@/modules/auth/sessions";
import { PLAYER_TOKEN_MAX_AGE, signPlayerToken } from "@/modules/auth/jwt";
import type { SiweTarget } from "@/modules/auth/service";
import { displayName } from "@/lib/format";
import { primaryWallet, toPublicUser, userWithIdentities, type UserWithIdentities } from "@/modules/users/dto";
import { listPublicBoards } from "@/modules/scores/boards-admin";
import type { ProjectContext } from "./client";

/** Câu chào trong thông điệp SIWE khi đăng nhập trên domain của game (EIP-4361: chỉ ASCII) */
export const PLATFORM_SIWE_STATEMENT =
  "Sign in with Monlabs Play. This request will not trigger a blockchain transaction or cost any gas fees.";

/** Thông điệp SIWE ghi đúng domain của game → ví hiện cho người chơi biết họ đang đăng nhập ở đâu */
export function siweTarget(ctx: ProjectContext): SiweTarget {
  return { domain: new URL(ctx.origin).host, uri: ctx.origin, statement: PLATFORM_SIWE_STATEMENT };
}

export function playerDto(user: UserWithIdentities) {
  const pub = toPublicUser(user);
  return {
    id: pub.id,
    displayName: displayName({ id: user.id, username: user.username, walletAddress: primaryWallet(user) }),
    walletAddress: pub.walletAddress,
    avatarUrl: pub.avatarUrl,
    isGuest: pub.isGuest,
  };
}

/** Thông tin công khai của project cho SDK */
export async function projectInfo(ctx: ProjectContext, locale: string) {
  const game = await prisma.game.findUniqueOrThrow({ where: { id: ctx.game.id }, include: { translations: true } });
  return {
    id: game.id,
    slug: game.slug,
    name: pickTranslation(game.translations, locale)?.name ?? game.slug,
    leaderboards: await listPublicBoards(game.id, locale),
    login: { wallet: true, guest: true },
  };
}

/** Phiên người chơi chỉ dùng cho đúng project này → trả token cho SDK giữ (không dùng cookie) */
export async function issuePlayerToken(req: Request, ctx: ProjectContext, user: UserWithIdentities) {
  const sid = await createAuthSession(user.id, req, { gameId: ctx.game.id, maxAgeSeconds: PLAYER_TOKEN_MAX_AGE });
  const token = await signPlayerToken({ sub: user.id, sid, gid: ctx.game.id });
  return { token, expiresIn: PLAYER_TOKEN_MAX_AGE, player: playerDto(user) };
}

/** Chơi khách: tạo tài khoản khách (isGuest) – sau này gắn ví được mà vẫn giữ dữ liệu */
export async function createGuestPlayer(req: Request, ctx: ProjectContext) {
  const user = await prisma.user.create({ data: { isGuest: true, lastLoginAt: new Date() }, include: userWithIdentities });
  await logEvent({ type: "auth.guest", userId: user.id, gameId: ctx.game.id, data: { origin: ctx.origin } });
  return issuePlayerToken(req, ctx, user);
}

export async function logoutPlayer(sid: string, userId: string) {
  await revokeSession(sid, userId);
}
