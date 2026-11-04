import { z } from "zod";
import { verifyMessage, type Hex } from "viem";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { ApiError, clientIp, handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { expectedSiwe } from "@/lib/auth/siwe";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/jwt";
import { toPublicUser } from "@/lib/auth/session";

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, "Chữ ký không hợp lệ"),
});

/**
 * Bước 2 đăng nhập: kiểm tra thông điệp SIWE + chữ ký, tạo user nếu mới, set cookie phiên.
 * Body: { message, signature }
 */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(`verify:${clientIp(req)}`, 20, 60_000);
    const body = bodySchema.parse(await readJson(req));

    const parsed = parseSiweMessage(body.message);
    if (!parsed.address || !parsed.nonce) {
      throw new ApiError(400, "INVALID_MESSAGE", "Thông điệp đăng nhập không hợp lệ");
    }

    // Kiểm tra domain, nonce khớp, thời hạn của thông điệp
    const { domain } = expectedSiwe(req);
    const validMessage = validateSiweMessage({ message: parsed, domain, nonce: parsed.nonce });
    if (!validMessage) {
      throw new ApiError(401, "INVALID_MESSAGE", "Thông điệp đăng nhập sai domain hoặc đã hết hạn");
    }

    // Kiểm tra chữ ký thật sự do ví đó ký
    const validSignature = await verifyMessage({
      address: parsed.address,
      message: body.message,
      signature: body.signature as Hex,
    });
    if (!validSignature) {
      throw new ApiError(401, "INVALID_SIGNATURE", "Chữ ký không khớp với địa chỉ ví");
    }

    const wallet = parsed.address.toLowerCase();

    // Đánh dấu nonce đã dùng (chỉ thành công 1 lần → chống replay)
    const consumed = await prisma.authNonce.updateMany({
      where: { nonce: parsed.nonce, walletAddress: wallet, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new ApiError(401, "NONCE_INVALID", "Phiên đăng nhập đã hết hạn, vui lòng thử lại");
    }

    // Quyền admin lấy theo ADMIN_WALLETS trong .env
    const role = env.adminWallets.includes(wallet) ? "ADMIN" : "USER";
    const now = new Date();
    const user = await prisma.user.upsert({
      where: { walletAddress: wallet },
      create: { walletAddress: wallet, role, lastLoginAt: now },
      update: { role, lastLoginAt: now },
    });

    const token = await signSession({ sub: user.id, wallet, role: user.role });
    const res = ok({ user: toPublicUser(user) });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  });
}
