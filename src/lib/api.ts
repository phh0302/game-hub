import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

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
    console.error("[api] Lỗi không mong muốn:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Lỗi máy chủ");
  }
}

/** Đọc body JSON an toàn (body rỗng/sai định dạng → lỗi 400) */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Body phải là JSON hợp lệ");
  }
}

/** Lấy IP client (phục vụ rate limit) */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
