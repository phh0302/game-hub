import { z } from "zod";
import { getAddress, isAddress } from "viem";
import { createSiweMessage, generateSiweNonce } from "viem/siwe";
import { prisma } from "@/lib/prisma";
import { clientIp, handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { expectedSiwe, NONCE_TTL_MS, SIWE_STATEMENT } from "@/lib/auth/siwe";

const bodySchema = z.object({
  address: z.string().refine((v) => isAddress(v, { strict: false }), "Địa chỉ ví không hợp lệ"),
  chainId: z.number().int().positive().default(1),
});

/**
 * Bước 1 đăng nhập: tạo nonce dùng 1 lần và trả về thông điệp SIWE để ví ký.
 * Body: { address: "0x...", chainId: 1 }
 */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(`nonce:${clientIp(req)}`, 20, 60_000);
    const body = bodySchema.parse(await readJson(req));

    const address = getAddress(body.address); // chuẩn EIP-55 (checksum)
    const nonce = generateSiweNonce();
    const issuedAt = new Date();
    const expirationTime = new Date(issuedAt.getTime() + NONCE_TTL_MS);

    await prisma.authNonce.create({
      data: { nonce, walletAddress: address.toLowerCase(), expiresAt: expirationTime },
    });

    // Dọn nonce cũ hơn 1 ngày
    await prisma.authNonce.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });

    const { domain, uri } = expectedSiwe(req);
    const message = createSiweMessage({
      address,
      chainId: body.chainId,
      domain,
      uri,
      nonce,
      version: "1",
      statement: SIWE_STATEMENT,
      issuedAt,
      expirationTime,
    });

    return ok({ message });
  });
}
