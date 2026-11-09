import { ApiError, handle, ok } from "@/lib/api";
import { localStorageDriver, verifyLocalUpload } from "@/modules/storage/local";
import { MAX_UPLOAD_BYTES } from "@/modules/uploads/limits";

/**
 * Nhận file upload khi chạy trên máy (STORAGE_DRIVER=local) – thay cho link ký sẵn của R2/S3.
 * Chỉ nhận đúng key + Content-Type + hạn dùng đã được server ký.
 */
export async function PUT(req: Request) {
  return handle(async () => {
    if (process.env.STORAGE_DRIVER === "s3") throw new ApiError(404, "NOT_FOUND", "Không dùng kho local");

    const q = new URL(req.url).searchParams;
    const key = q.get("key") ?? "";
    const contentType = q.get("ct") ?? "";
    const exp = Number(q.get("exp"));
    const sig = q.get("sig") ?? "";
    if (!/^[0-9a-f]{64}$/.test(sig) || !verifyLocalUpload(key, contentType, exp, sig)) {
      throw new ApiError(403, "UPLOAD_LINK_INVALID", "Link upload không hợp lệ hoặc đã hết hạn");
    }
    if ((req.headers.get("content-type") ?? "") !== contentType) {
      throw new ApiError(400, "CONTENT_TYPE_MISMATCH", "Sai loại file");
    }

    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_UPLOAD_BYTES) throw new ApiError(413, "FILE_TOO_LARGE", "File quá lớn");
    const body = new Uint8Array(await req.arrayBuffer());
    if (body.byteLength > MAX_UPLOAD_BYTES) throw new ApiError(413, "FILE_TOO_LARGE", "File quá lớn");

    await localStorageDriver.put(key, body, contentType);
    return ok({ key, size: body.byteLength });
  });
}
