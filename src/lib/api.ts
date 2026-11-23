import { after, NextResponse } from "next/server";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { reportError } from "./monitoring";
import { log, REQUEST_ID_HEADER } from "./log";

/**
 * Lỗi nghiệp vụ trả về cho client.
 * `code` là mã ổn định để frontend dịch sang tiếng Việt/Anh.
 */
export class ApiError extends Error {
  /** Với lỗi 429: số giây nên chờ (gửi kèm header Retry-After) */
  public retryAfter?: number;
  constructor(
    public status: number,
    public code: string,
    message?: string,
    options: { retryAfter?: number } = {},
  ) {
    super(message ?? code);
    this.retryAfter = options.retryAfter;
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function errorResponse(status: number, code: string, message: string, details?: unknown, retryAfter?: number) {
  // Mọi 429 đều có Retry-After (mặc định 60 giây) – giống lớp chặn chung ở middleware
  const wait = status === 429 ? Math.max(1, Math.ceil(retryAfter ?? 60)) : undefined;
  return NextResponse.json(
    { error: { code, message, details, ...(wait ? { retryAfter: wait } : {}) } },
    { status, headers: wait ? { "Retry-After": String(wait) } : undefined },
  );
}

/** Request chậm hơn mức này được ghi log cảnh báo (mặc định 2 giây) */
const SLOW_MS = Number(process.env.SLOW_REQUEST_MS) > 0 ? Number(process.env.SLOW_REQUEST_MS) : 2000;

type RequestMeta = { requestId: string | null; route: string | null; started: number | null; sampled: boolean };

/** Thông tin middleware gắn vào request: mã request, route đã chuẩn hóa, thời điểm bắt đầu, có lấy mẫu hay không */
async function requestMeta(): Promise<RequestMeta | null> {
  try {
    const h = await headers();
    const started = Number(h.get("x-mon-t"));
    return {
      requestId: h.get(REQUEST_ID_HEADER),
      route: h.get("x-mon-r"),
      started: Number.isFinite(started) && started > 0 ? started : null,
      sampled: h.get("x-mon-s") === "1",
    };
  } catch {
    return null; // ngoài ngữ cảnh request (test)
  }
}

/** Bọc handler của route: chuyển mọi lỗi thành JSON thống nhất, ghi log request lỗi/chậm, ghi số liệu khi được lấy mẫu */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  const meta = await requestMeta();
  const res = await run(fn, meta);
  if (meta) observe(res.status, meta);
  return res;
}

/**
 * Sau khi trả lời: request lỗi 5xx / chậm → 1 dòng log JSON (kèm mã request);
 * request được lấy mẫu → ghi mã trạng thái + độ trễ (tổng và theo route), rồi chạy phát hiện bất thường.
 */
function observe(status: number, meta: RequestMeta) {
  const ms = meta.started ? Math.max(0, Date.now() - meta.started) : 0;
  const fields = { requestId: meta.requestId, route: meta.route, status, ms };
  if (status >= 500) log.error("request.failed", fields);
  else if (ms >= SLOW_MS) log.warn("request.slow", fields);
  if (!meta.sampled) return;
  try {
    after(async () => {
      const [{ recordResult }, { maybeDetect }] = await Promise.all([
        import("./traffic/recorder"),
        import("@/modules/traffic/detect"),
      ]);
      await recordResult({ status, ms, route: meta.route ?? undefined });
      await maybeDetect();
    });
  } catch {
    // ngoài ngữ cảnh request (test) → bỏ qua
  }
}

async function run(fn: () => Promise<Response>, meta: RequestMeta | null): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return errorResponse(err.status, err.code, err.message, undefined, err.retryAfter);
    }
    if (err instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", err.flatten());
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return errorResponse(409, "CONFLICT", "Dữ liệu đã tồn tại");
      if (err.code === "P2025") return errorResponse(404, "NOT_FOUND", "Không tìm thấy dữ liệu");
      if (err.code === "P2003") return errorResponse(400, "INVALID_REFERENCE", "Dữ liệu liên kết không tồn tại");
    }
    const requestId = meta?.requestId ?? undefined;
    await reportError(err, {
      tags: { area: "api", ...(meta?.route ? { route: meta.route } : {}), ...(requestId ? { request_id: requestId } : {}) },
    });
    // Mã request trong body: người dùng gửi kèm khi báo lỗi → tra đúng dòng log / sự kiện Sentry
    return errorResponse(500, "INTERNAL_ERROR", "Lỗi máy chủ", requestId ? { requestId } : undefined);
  }
}

/** API của hub chỉ nhận JSON nhỏ – chặn body lớn để tránh tốn bộ nhớ */
const MAX_JSON_BYTES = 64 * 1024;

/** Đọc body JSON an toàn (rỗng / sai định dạng → 400, quá lớn → 413) */
export async function readJson(req: Request, options: { optional?: boolean; maxBytes?: number } = {}): Promise<unknown> {
  const maxBytes = options.maxBytes ?? MAX_JSON_BYTES;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dữ liệu gửi lên quá lớn");
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Body phải là JSON hợp lệ");
  }
  // Content-length có thể bị bỏ qua (chunked) → kiểm tra lại độ dài thật
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dữ liệu gửi lên quá lớn");
  }
  // Body không bắt buộc (vd nút bấm không có dữ liệu) → coi như {}
  if (options.optional && text.trim() === "") return {};
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
