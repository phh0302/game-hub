import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { reportError } from "./monitoring";

/**
 * Lỗi nghiệp vụ trả về cho client.
 * `code` là mã ổn định để frontend dịch sang tiếng Việt/Anh.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

/** Bọc handler của route: chuyển mọi lỗi thành JSON thống nhất */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return errorResponse(err.status, err.code, err.message);
    }
    if (err instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", err.flatten());
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return errorResponse(409, "CONFLICT", "Dữ liệu đã tồn tại");
      if (err.code === "P2025") return errorResponse(404, "NOT_FOUND", "Không tìm thấy dữ liệu");
      if (err.code === "P2003") return errorResponse(400, "INVALID_REFERENCE", "Dữ liệu liên kết không tồn tại");
    }
    await reportError(err, { tags: { area: "api" } });
    return errorResponse(500, "INTERNAL_ERROR", "Lỗi máy chủ");
  }
}

/** API của hub chỉ nhận JSON nhỏ – chặn body lớn để tránh tốn bộ nhớ */
const MAX_JSON_BYTES = 64 * 1024;

/** Đọc body JSON an toàn (rỗng / sai định dạng → 400, quá lớn → 413) */
export async function readJson(req: Request): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_JSON_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dữ liệu gửi lên quá lớn");
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Body phải là JSON hợp lệ");
  }
  // Content-length có thể bị bỏ qua (chunked) → kiểm tra lại độ dài thật
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dữ liệu gửi lên quá lớn");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Body phải là JSON hợp lệ");
  }
}

/**
 * Lấy IP client (phục vụ rate limit).
 * Lưu ý: x-forwarded-for chỉ đáng tin khi chạy sau proxy/CDN tự ghi header này (Vercel, Nginx…).
 * Tự host mà để Node lộ trực tiếp ra Internet thì người dùng có thể giả header → nên đặt sau Nginx.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
