import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/format";
import { logEvent } from "@/modules/events/service";
import { primaryWallet } from "@/modules/users/dto";
import { isInviteCode, newInviteCode } from "./codes";

/** Mã mời của user (tạo lần đầu khi cần) */
export async function getOrCreateInviteCode(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { inviteCode: true } });
  if (user.inviteCode) return user.inviteCode;
  for (let i = 0; i < 5; i++) {
    try {
      const code = newInviteCode();
      const updated = await prisma.user.updateMany({ where: { id: userId, inviteCode: null }, data: { inviteCode: code } });
      if (updated.count === 1) return code;
      // Tiến trình khác vừa tạo → đọc lại
      const again = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { inviteCode: true } });
      if (again.inviteCode) return again.inviteCode;
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err; // trùng mã → thử mã khác
    }
  }
  throw new Error("Không tạo được mã mời");
}

/**
 * Tài khoản mới (lần đầu gắn ví) đến từ link mời → ghi nhận người mời.
 * Bỏ qua: mã sai, tự mời mình, người mời đã bị khóa/xóa, đã được ghi nhận trước đó.
 */
export async function recordReferral(inviteeId: string, ref: { code: string; slug: string | null }) {
  if (!isInviteCode(ref.code)) return null;
  const inviter = await prisma.user.findUnique({
    where: { inviteCode: ref.code },
    select: { id: true, deletedAt: true, suspendedAt: true, isGuest: true },
  });
  if (!inviter || inviter.id === inviteeId || inviter.deletedAt || inviter.suspendedAt || inviter.isGuest) return null;
  const game = ref.slug ? await prisma.game.findUnique({ where: { slug: ref.slug }, select: { id: true } }) : null;
  try {
    const r = await prisma.referral.create({ data: { inviterId: inviter.id, inviteeId, gameId: game?.id ?? null } });
    await logEvent({ type: "referral.create", userId: inviter.id, gameId: game?.id, data: { inviteeId } });
    return r;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null; // đã ghi nhận
    throw err;
  }
}

/** Thông tin mời cho người chơi: mã của mình, số bạn đã mời (tổng / qua game này), ai đã mời mình */
export async function getInviteInfo(userId: string, gameSlug?: string | null) {
  const code = await getOrCreateInviteCode(userId);
  const game = gameSlug ? await prisma.game.findUnique({ where: { slug: gameSlug }, select: { id: true } }) : null;
  const [total, viaGame, invitedBy] = await Promise.all([
    prisma.referral.count({ where: { inviterId: userId } }),
    game ? prisma.referral.count({ where: { inviterId: userId, gameId: game.id } }) : Promise.resolve(0),
    prisma.referral.findUnique({ where: { inviteeId: userId }, include: { inviter: { include: { identities: true } } } }),
  ]);
  return {
    code,
    invited: total,
    invitedViaGame: viaGame,
    invitedBy: invitedBy
      ? displayName({ id: invitedBy.inviter.id, username: invitedBy.inviter.username, walletAddress: primaryWallet(invitedBy.inviter) })
      : null,
  };
}

/** Danh sách bạn đã mời (trang hồ sơ) */
export async function listInvitees(userId: string) {
  const rows = await prisma.referral.findMany({
    where: { inviterId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { invitee: { include: { identities: true } }, game: { select: { slug: true } } },
  });
  return rows.map((r) => ({
    name: displayName({ id: r.invitee.id, username: r.invitee.username, walletAddress: primaryWallet(r.invitee) }),
    game: r.game?.slug ?? null,
    at: r.createdAt.toISOString(),
  }));
}
