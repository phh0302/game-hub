/**
 * DB chỉ lưu "key" tương đối của file. URL đầy đủ ghép từ cấu hình
 * → đổi CDN / kho lưu trữ chỉ cần sửa .env, không sửa dữ liệu.
 *
 * Hai nhóm file:
 * - File đóng gói cùng web (game chính thức, ảnh mẫu): key thường, vd "games/2048/thumbnail.svg"
 *   → phục vụ từ thư mục public/uploads của web
 * - File người dùng upload (bản build của developer, ảnh bìa…): key bắt đầu bằng "u/"
 *   → phục vụ từ kho lưu trữ (Cloudflare R2 / S3 ở production, public/uploads/u ở máy dev)
 */
const trimSlash = (s: string) => s.replace(/\/+$/, "");

const ASSET_BASE = trimSlash(process.env.NEXT_PUBLIC_ASSET_BASE_URL || "/uploads");
// Game chính thức có thể đặt ở domain riêng (vd: https://games.gamehub.vn) để cô lập với hub
const GAME_BASE = trimSlash(process.env.NEXT_PUBLIC_GAME_BASE_URL || ASSET_BASE);
// Kho file người dùng upload – production nên là domain KHÁC hub (vd: https://cdn.gamehub.vn)
const UPLOAD_BASE = trimSlash(process.env.NEXT_PUBLIC_UPLOAD_BASE_URL || "/uploads");

/** Tiền tố key của mọi file người dùng upload */
export const UPLOAD_PREFIX = "u/";

const isAbsolute = (key: string) => /^https?:\/\//i.test(key);
const clean = (key: string) => key.replace(/^\/+/, "");
export const isUploadKey = (key: string) => clean(key).startsWith(UPLOAD_PREFIX);

export function assetUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (isAbsolute(key)) return key;
  return `${isUploadKey(key) ? UPLOAD_BASE : ASSET_BASE}/${clean(key)}`;
}

export function gameEntryUrl(version: { storageKey: string; entryFile: string }): string {
  const dir = version.storageKey.replace(/^\/+|\/+$/g, "");
  const base = isUploadKey(dir) ? UPLOAD_BASE : GAME_BASE;
  return `${base}/${dir}/${clean(version.entryFile)}`;
}
