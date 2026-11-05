/**
 * DB chỉ lưu "key" tương đối của file (vd: "games/2048/thumbnail.svg").
 * URL đầy đủ ghép từ cấu hình → đổi CDN / kho lưu trữ chỉ cần sửa .env, không sửa dữ liệu.
 */
const trimSlash = (s: string) => s.replace(/\/+$/, "");

const ASSET_BASE = trimSlash(process.env.NEXT_PUBLIC_ASSET_BASE_URL || "/uploads");
// Game của developer nên chạy ở domain riêng (vd: https://games.gamehub.vn) để cô lập với hub
const GAME_BASE = trimSlash(process.env.NEXT_PUBLIC_GAME_BASE_URL || ASSET_BASE);

const isAbsolute = (key: string) => /^https?:\/\//i.test(key);

export function assetUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (isAbsolute(key)) return key;
  return `${ASSET_BASE}/${key.replace(/^\/+/, "")}`;
}

export function gameEntryUrl(version: { storageKey: string; entryFile: string }): string {
  const dir = version.storageKey.replace(/^\/+|\/+$/g, "");
  return `${GAME_BASE}/${dir}/${version.entryFile.replace(/^\/+/, "")}`;
}
