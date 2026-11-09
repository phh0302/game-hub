import { unzipSync, type UnzipFileInfo } from "fflate";
import { buildContentType, extensionOf } from "./content-types.ts";
import { MAX_BUILD_FILES, MAX_UNZIPPED_BYTES } from "./limits.ts";

/**
 * Kiểm tra + giải nén bản build game (.zip) – chạy hoàn toàn trong bộ nhớ.
 * Chặn: zip bomb (giới hạn tổng dung lượng/số file theo khai báo, rồi đối chiếu kích thước thật),
 * đường dẫn thoát thư mục (../, đường dẫn tuyệt đối), file không thuộc danh sách cho phép.
 * Tự bỏ 1 cấp thư mục gốc nếu người dùng nén cả thư mục (vd: my-game/index.html).
 */

export type BuildFile = { path: string; data: Uint8Array; contentType: string };

export type ZipErrorCode =
  | "ZIP_INVALID"
  | "ZIP_EMPTY"
  | "ZIP_TOO_MANY_FILES"
  | "ZIP_TOO_LARGE_UNZIPPED"
  | "ZIP_UNSAFE_PATH"
  | "ZIP_FILE_TYPE_NOT_ALLOWED"
  | "ZIP_NO_INDEX_HTML";

export class ZipValidationError extends Error {
  // Khai báo field tường minh (không dùng "public" trong constructor) để Node chạy test được bằng type stripping
  code: ZipErrorCode;
  detail?: string;

  constructor(code: ZipErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
    this.detail = detail;
  }
}

/** File rác hệ điều hành – bỏ qua, không tính là lỗi */
const IGNORED = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$)/i;

function normalize(name: string): string {
  return name.replace(/\\/g, "/");
}

function isUnsafe(path: string): boolean {
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path) || /[\u0000-\u001f\u007f]/.test(path)) return true;
  return path.split("/").some((seg) => seg === ".." || seg === "." || seg === "");
}

export function extractBuild(zip: Uint8Array): { files: BuildFile[]; totalBytes: number; strippedFolder: string | null } {
  // Lượt 1: chỉ đọc danh mục file (không giải nén) để kiểm tra trước
  const infos: UnzipFileInfo[] = [];
  try {
    unzipSync(zip, {
      filter: (file) => {
        infos.push(file);
        return false;
      },
    });
  } catch (err) {
    throw new ZipValidationError("ZIP_INVALID", err instanceof Error ? err.message : undefined);
  }

  const entries = infos.filter((f) => {
    const name = normalize(f.name);
    return !name.endsWith("/") && !IGNORED.test(name);
  });
  if (entries.length === 0) throw new ZipValidationError("ZIP_EMPTY");
  if (entries.length > MAX_BUILD_FILES) throw new ZipValidationError("ZIP_TOO_MANY_FILES", String(entries.length));

  let declared = 0;
  for (const f of entries) {
    const name = normalize(f.name);
    if (isUnsafe(name)) throw new ZipValidationError("ZIP_UNSAFE_PATH", name);
    if (!buildContentType(name)) {
      throw new ZipValidationError("ZIP_FILE_TYPE_NOT_ALLOWED", `${name} (.${extensionOf(name) || "?"})`);
    }
    declared += f.originalSize;
    if (declared > MAX_UNZIPPED_BYTES) throw new ZipValidationError("ZIP_TOO_LARGE_UNZIPPED");
  }

  // Tìm index.html: ở gốc, hoặc trong đúng 1 thư mục bao ngoài
  const names = entries.map((f) => normalize(f.name));
  let prefix = "";
  if (!names.includes("index.html")) {
    const top = names[0].split("/")[0];
    const allInTop = names.every((n) => n.startsWith(`${top}/`));
    if (allInTop && names.includes(`${top}/index.html`)) prefix = `${top}/`;
    else throw new ZipValidationError("ZIP_NO_INDEX_HTML");
  }

  // Lượt 2: giải nén đúng các file đã duyệt
  const wanted = new Set(entries.map((f) => f.name));
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(zip, { filter: (file) => wanted.has(file.name) });
  } catch (err) {
    throw new ZipValidationError("ZIP_INVALID", err instanceof Error ? err.message : undefined);
  }

  let totalBytes = 0;
  const files: BuildFile[] = [];
  for (const info of entries) {
    const data = unzipped[info.name];
    // Kích thước thật phải khớp khai báo (zip bomb hay khai man kích thước)
    if (!data || data.byteLength !== info.originalSize) throw new ZipValidationError("ZIP_INVALID", info.name);
    totalBytes += data.byteLength;
    if (totalBytes > MAX_UNZIPPED_BYTES) throw new ZipValidationError("ZIP_TOO_LARGE_UNZIPPED");
    const path = normalize(info.name).slice(prefix.length);
    files.push({ path, data, contentType: buildContentType(path)! });
  }

  return { files, totalBytes, strippedFolder: prefix ? prefix.slice(0, -1) : null };
}
