/**
 * Log có cấu trúc: mỗi dòng là 1 JSON (dễ lọc trong Vercel → Logs, Docker logs, Loki…).
 * { ts, level, msg, ...fields } – trường nhạy cảm (cookie, token, secret…) bị ẩn, chuỗi dài bị cắt.
 * Chạy được ở cả Node lẫn Edge runtime.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE = /(cookie|authorization|token|secret|password|signature|private|passphrase|apikey|api_key)/i;
const MAX_STRING = 500;

function minLevel(): number {
  const raw = (typeof process !== "undefined" ? process.env.LOG_LEVEL : undefined)?.toLowerCase() as LogLevel | undefined;
  return ORDER[raw && raw in ORDER ? raw : "info"];
}

/** Ẩn khóa nhạy cảm, cắt chuỗi dài, đổi Error thành {name,message} – giới hạn độ sâu 3 */
export function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) return { name: value.name, message: sanitize(value.message, depth + 1) };
  if (value instanceof Date) return value.toISOString();
  if (depth >= 3) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      out[k] = SENSITIVE.test(k) ? "[redacted]" : sanitize(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Dòng log dạng chuỗi JSON (tách riêng để test) */
export function formatLog(level: LogLevel, msg: string, fields: LogFields = {}, now = new Date()): string {
  const clean = sanitize(fields) as Record<string, unknown>;
  return JSON.stringify({ ts: now.toISOString(), level, msg, ...clean });
}

function write(level: LogLevel, msg: string, fields?: LogFields) {
  if (ORDER[level] < minLevel()) return;
  const line = formatLog(level, msg, fields);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, fields?: LogFields) => write("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => write("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => write("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => write("error", msg, fields),
};

/** Header mang mã request: middleware gắn vào request (route đọc được) và response (client / người dùng báo lỗi) */
export const REQUEST_ID_HEADER = "x-request-id";
const SAFE_ID = /^[A-Za-z0-9:._-]{8,128}$/;

/**
 * Mã request: dùng lại id của nền tảng nếu hợp lệ (Vercel: x-vercel-id → khớp với Vercel Logs),
 * không thì tạo mới. Không nhận id client tự gửi (tránh giả mạo / chèn log).
 */
export function pickRequestId(platformId: string | null | undefined): string {
  if (platformId && SAFE_ID.test(platformId)) return platformId;
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}
