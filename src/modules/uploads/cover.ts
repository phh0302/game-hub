// Tìm ảnh bìa có sẵn trong bản build (game chưa có ảnh bìa → hub tự lấy). Hàm thuần để unit test.
import { detectImageType, type ImageKind } from "./image.ts";
import { MAX_IMAGE_BYTES } from "./limits.ts";

/** Tên file được coi là ảnh bìa, theo thứ tự ưu tiên (ở gốc bản build hoặc thư mục assets/, images/, img/) */
export const COVER_NAMES = ["cover", "thumbnail", "banner", "og-image", "og", "social", "share", "preview"];
const EXTS = ["png", "jpg", "jpeg", "webp"];
const DIRS = ["", "assets/", "images/", "img/"];

/** Các đường dẫn ứng viên theo thứ tự ưu tiên */
export function coverCandidatePaths(): string[] {
  const out: string[] = [];
  for (const dir of DIRS) for (const name of COVER_NAMES) for (const ext of EXTS) out.push(`${dir}${name}.${ext}`);
  return out;
}

export type CoverPick = { path: string; data: Uint8Array; kind: ImageKind; contentType: string };

const CONTENT_TYPE: Record<ImageKind, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

/** Kiểm tra 1 file có dùng làm ảnh bìa được không: đúng chữ ký PNG/JPG/WebP và ≤ 1MB */
export function asCover(path: string, data: Uint8Array): CoverPick | null {
  if (data.byteLength === 0 || data.byteLength > MAX_IMAGE_BYTES) return null;
  const kind = detectImageType(data);
  return kind ? { path, data, kind, contentType: CONTENT_TYPE[kind] } : null;
}

/** Ảnh bìa đầu tiên hợp lệ trong danh sách file của bản build (không phân biệt hoa thường) */
export function pickCover(files: { path: string; data: Uint8Array }[]): CoverPick | null {
  const byPath = new Map(files.map((f) => [f.path.toLowerCase(), f]));
  for (const p of coverCandidatePaths()) {
    const f = byPath.get(p);
    const pick = f && asCover(f.path, f.data);
    if (pick) return pick;
  }
  return null;
}
