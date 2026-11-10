import "server-only";
import { z } from "zod";
import { getAddress, isAddress, verifyMessage, type Hex } from "viem";
import { createSiweMessage, generateSiweNonce, parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/api";
import { logEvent } from "@/modules/events/service";
import { userWithIdentities, type UserWithIdentities } from "@/modules/users/dto";
import { expectedSiwe, NONCE_TTL_MS, SIWE_STATEMENT } from "./siwe";

export const challengeSchema = z.object({
  address: z.string().refine((v) => isAddress(v, { strict: false }), "Địa chỉ ví không hợp lệ"),
  chainId: z.number().int().positive().default(1),
});

export const verifySchema = z.object({
  message: z.string().min(1).max(2000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, "Chữ ký không hợp lệ"),
});

/** Bước 1: tạo nonce dùng 1 lần + thông điệp SIWE để ví ký */
export async function createWalletChallenge(req: Request, input: z.infer<typeof challengeSchema>) {
  const address = getAddress(input.address); // chuẩn EIP-55 (checksum)
  const nonce = generateSiweNonce();
  const issuedAt = new Date();
  const expirationTime = new Date(issuedAt.getTime() + NONCE_TTL_MS);

  await prisma.authNonce.create({
    data: { nonce, provider: "WALLET", identifier: address.toLowerCase(), expiresAt: expirationTime },
  });

  // Dọn nonce cũ hơn 1 ngày
  await prisma.authNonce.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  const { domain, uri } = expectedSiwe(req);
  return createSiweMessage({
    address,
    chainId: input.chainId,
    domain,
    uri,
    nonce,
    version: "1",
    statement: SIWE_STATEMENT,
    issuedAt,
    expirationTime,
  });
}

/** Bước 2: xác minh chữ ký → trả về user (tạo mới nếu ví chưa từng đăng nhập) */
export async function verifyWalletLogin(
  req: Request,
  input: z.infer<typeof verifySchema>,
): Promise<UserWithIdentities> {
  const parsed = parseSiweMessage(input.message);
  if (!parsed.address || !parsed.nonce) {
    throw new ApiError(400, "INVALID_MESSAGE", "Thông điệp đăng nhập không hợp lệ");
  }

  // Domain, nonce, thời hạn của thông điệp
  const { domain } = expectedSiwe(req);
  if (!validateSiweMessage({ message: parsed, domain, nonce: parsed.nonce })) {
    throw new ApiError(401, "INVALID_MESSAGE", "Thông điệp đăng nhập sai domain hoặc đã hết hạn");
  }

  // Chữ ký thật sự do ví đó ký
  const validSignature = await verifyMessage({
    address: parsed.address,
    message: input.message,
    signature: input.signature as Hex,
  });
  if (!validSignature) {
    throw new ApiError(401, "INVALID_SIGNATURE", "Chữ ký không khớp với địa chỉ ví");
  }

  const wallet = parsed.address.toLowerCase();

  // Đánh dấu nonce đã dùng – chỉ thành công 1 lần → chống replay
  const consumed = await prisma.authNonce.updateMany({
    where: {
      nonce: parsed.nonce,
      provider: "WALLET",
      identifier: wallet,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) {
    throw new ApiError(401, "NONCE_INVALID", "Phiên đăng nhập đã hết hạn, vui lòng thử lại");
  }

  const now = new Date();
  // ADMIN_WALLETS chỉ dùng để CẤP quyền admin. Thu hồi quyền: sửa role trong database.
  const isAdminWallet = env.adminWallets.includes(wallet);

  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerUserId: { provider: "WALLET", providerUserId: wallet } },
  });

  let user: UserWithIdentities;
  if (identity) {
    await prisma.authIdentity.update({ where: { id: identity.id }, data: { lastUsedAt: now } });
    user = await prisma.user.update({
      where: { id: identity.userId },
      data: { lastLoginAt: now, ...(isAdminWallet ? { role: "ADMIN" as const } : {}) },
      include: userWithIdentities,
    });
    if (user.deletedAt) throw new ApiError(403, "ACCOUNT_DISABLED", "Tài khoản đã bị khóa");
    if (user.suspendedAt) throw new ApiError(403, "ACCOUNT_SUSPENDED", user.suspendReason ?? "Tài khoản đã bị khóa");
  } else {
    user = await prisma.user.create({
      data: {
        role: isAdminWallet ? "ADMIN" : "USER",
        lastLoginAt: now,
        identities: { create: { provider: "WALLET", providerUserId: wallet, lastUsedAt: now } },
      },
      include: userWithIdentities,
    });
  }

  await logEvent({ type: "auth.login", userId: user.id, data: { provider: "WALLET", isNew: !identity } });
  return user;
}
