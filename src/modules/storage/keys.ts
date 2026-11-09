// Quy ước key trong kho lưu trữ – hàm thuần để unit test

/** Key hợp lệ: không rỗng, không "..", không bắt đầu bằng "/", không ký tự điều khiển / backslash */
export function isSafeKey(key: string): boolean {
  if (!key || key.length > 512) return false;
  if (key.startsWith("/") || key.includes("\\") || /[\u0000-\u001f\u007f]/.test(key)) return false;
  return key.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

/** Zip đang chờ xử lý – thư mục riêng từng user, kho lưu trữ nên tự xóa sau 1 ngày */
export const incomingZipKey = (userId: string, id: string) => `u/incoming/${userId}/${id}.zip`;
export const isIncomingKeyOf = (key: string, userId: string) =>
  isSafeKey(key) && key.startsWith(`u/incoming/${userId}/`) && key.endsWith(".zip");

/** Ảnh (ảnh bìa game, avatar) do user upload */
export const imageKey = (userId: string, id: string, ext: string) => `u/images/${userId}/${id}.${ext}`;
export const isImageKeyOf = (key: string, userId: string) => isSafeKey(key) && key.startsWith(`u/images/${userId}/`);

/** Thư mục chứa bản build đã giải nén của 1 phiên bản game */
export const buildDir = (gameSlug: string, version: string) => `u/games/${gameSlug}/${version}`;
