/**
 * Gửi lỗi lên Sentry qua HTTP (giao thức "envelope") – không cần thư viện @sentry/*.
 * Chưa đặt SENTRY_DSN → chỉ ghi console (xem trong Vercel → Logs).
 * Dùng được ở cả Node lẫn Edge runtime (chỉ dùng fetch + crypto.randomUUID).
 */

type ReportContext = {
  level?: "error" | "warning";
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  request?: { method?: string; url?: string };
  userId?: string;
};

type Dsn = { endpoint: string; key: string; dsn: string };

function parseDsn(value: string | undefined): Dsn | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    const projectId = u.pathname.replace(/^\/+|\/+$/g, "");
    if (!u.username || !projectId) return null;
    return { endpoint: `${u.protocol}//${u.host}/api/${projectId}/envelope/`, key: u.username, dsn: value };
  } catch {
    return null;
  }
}

/** Tách stack trace kiểu V8 ("at fn (file:line:col)") thành frame cho Sentry */
function frames(stack: string | undefined) {
  if (!stack) return undefined;
  const out = stack
    .split("\n")
    .slice(1, 51)
    .map((line) => {
      const m = line.trim().match(/^at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/);
      return m ? { function: m[1] ?? "?", filename: m[2], lineno: Number(m[3]), colno: Number(m[4]), in_app: !m[2].includes("node_modules") } : null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)
    .reverse(); // Sentry: frame gần lỗi nhất nằm cuối
  return out.length ? { frames: out } : undefined;
}

const SENSITIVE = /(cookie|authorization|token|secret|password|signature|private)/i;

function scrub(value: Record<string, unknown> | undefined) {
  if (!value) return undefined;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SENSITIVE.test(k) ? "[đã ẩn]" : v]));
}

export async function reportError(err: unknown, ctx: ReportContext = {}): Promise<void> {
  const error = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
  console.error(`[error]${ctx.tags?.area ? ` [${ctx.tags.area}]` : ""}`, error);

  const dsn = parseDsn(process.env.SENTRY_DSN);
  if (!dsn) return;

  const eventId = crypto.randomUUID().replace(/-/g, "");
  const now = new Date().toISOString();
  // Bỏ query string khỏi URL (có thể chứa thông tin riêng tư)
  const url = ctx.request?.url?.split("?")[0];
  const event = {
    event_id: eventId,
    timestamp: now,
    platform: "javascript",
    level: ctx.level ?? "error",
    logger: "gamehub",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    server_name: process.env.VERCEL_REGION,
    tags: ctx.tags,
    extra: scrub(ctx.extra),
    user: ctx.userId ? { id: ctx.userId } : undefined,
    request: url ? { method: ctx.request?.method, url } : undefined,
    exception: {
      values: [{ type: error.name || "Error", value: error.message.slice(0, 2000), stacktrace: frames(error.stack) }],
    },
  };
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: now, dsn: dsn.dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");

  try {
    await fetch(dsn.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${dsn.key}, sentry_client=gamehub/1.0`,
      },
      body,
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
  } catch {
    // Không để lỗi gửi báo cáo làm hỏng request chính
  }
}
