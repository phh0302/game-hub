import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { ApiKeyKind } from "@prisma/client";

const KEY_PREFIX: Record<ApiKeyKind, string> = { PUBLISHABLE: "pk_live_", SECRET: "sk_live_" };
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Chuỗi ngẫu nhiên base62 (không lệch phân bố: bỏ byte ≥ 248) */
export function randomBase62(length: number) {
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < 248 && out.length < length) out += ALPHABET[b % 62];
    }
  }
  return out;
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** Tạo khóa mới: trả về khóa đầy đủ (chỉ hiện 1 lần), bản băm để lưu, và phần đầu để nhận diện */
export function generateApiKey(kind: ApiKeyKind) {
  const key = KEY_PREFIX[kind] + randomBase62(32);
  return { key, keyHash: hashApiKey(key), prefix: key.slice(0, 12) };
}

/** Kiểm tra nhanh định dạng trước khi tra database */
export function looksLikeApiKey(value: string | null | undefined, kind: ApiKeyKind): value is string {
  return typeof value === "string" && value.startsWith(KEY_PREFIX[kind]) && /^[a-z]{2}_live_[0-9A-Za-z]{32}$/.test(value);
}
