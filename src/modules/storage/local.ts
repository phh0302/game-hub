import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSafeKey } from "./keys";
import type { StorageDriver, UploadTicket } from "./types";

/**
 * Lưu file vào public/uploads trên máy – CHỈ dùng khi phát triển.
 * (Next.js production không phục vụ file thêm vào public sau khi build, và Vercel không cho ghi đĩa.)
 */
const ROOT = path.join(process.cwd(), "public", "uploads");

function resolveKey(key: string) {
  if (!isSafeKey(key)) throw new Error(`Key không hợp lệ: ${key}`);
  const full = path.resolve(ROOT, key);
  // Chặn thoát ra ngoài thư mục uploads
  if (!full.startsWith(ROOT + path.sep)) throw new Error(`Key không hợp lệ: ${key}`);
  return full;
}

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("Thiếu JWT_SECRET");
  return value;
}

/** Chữ ký cho link upload local (key + content-type + hạn dùng) */
export function signLocalUpload(key: string, contentType: string, exp: number) {
  return createHmac("sha256", secret()).update(`${key}\n${contentType}\n${exp}`).digest("hex");
}

export function verifyLocalUpload(key: string, contentType: string, exp: number, sig: string) {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(signLocalUpload(key, contentType, exp), "hex");
  const given = Buffer.from(sig, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const localStorageDriver: StorageDriver = {
  name: "local",

  async put(key, body) {
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  },

  async get(key) {
    try {
      return new Uint8Array(await readFile(resolveKey(key)));
    } catch {
      return null;
    }
  },

  async delete(key) {
    await rm(resolveKey(key), { force: true });
  },

  async createUploadTicket(key, contentType, expiresInSeconds): Promise<UploadTicket> {
    resolveKey(key);
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const qs = new URLSearchParams({ key, ct: contentType, exp: String(exp), sig: signLocalUpload(key, contentType, exp) });
    return {
      url: `/api/v1/storage/local?${qs}`,
      method: "PUT",
      headers: { "Content-Type": contentType },
      key,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  },
};
