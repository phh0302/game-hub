import type { Prisma } from "@prisma/client";
import { assetUrl, isUploadKey } from "@/lib/assets";

export const userWithIdentities = { identities: true } satisfies Prisma.UserInclude;
export type UserWithIdentities = Prisma.UserGetPayload<{ include: typeof userWithIdentities }>;

/** Thông tin user an toàn để gửi xuống client */
export type PublicUser = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
  isGuest: boolean;
  /** Ví đăng nhập đầu tiên của user (null nếu là khách / đăng nhập cách khác) */
  walletAddress: string | null;
};

export function primaryWallet(user: UserWithIdentities): string | null {
  const wallets = user.identities
    .filter((i) => i.provider === "WALLET")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return wallets[0]?.providerUserId ?? null;
}

export function toPublicUser(user: UserWithIdentities): PublicUser {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: avatarUrl(user.avatarKey),
    role: user.role,
    isGuest: user.isGuest,
    walletAddress: primaryWallet(user),
  };
}

/** Chỉ hiện ảnh đại diện đã upload lên kho của hub – link ngoài cũ (trước khi có upload) bị bỏ qua */
export function avatarUrl(key: string | null | undefined): string | null {
  return key && isUploadKey(key) ? assetUrl(key) : null;
}
