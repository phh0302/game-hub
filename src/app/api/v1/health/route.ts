import { prisma } from "@/lib/prisma";
import { rateLimitBackend } from "@/lib/rate-limit";
import { log } from "@/lib/log";

// Kiểm tra web + database còn sống (uptime monitor, trang trạng thái monlabs.fun/status)
export const dynamic = "force-dynamic";

/** Trang trạng thái gọi từ domain khác; dữ liệu không nhạy cảm, không dùng cookie */
const HEADERS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      db: "ok",
      latencyMs: Date.now() - startedAt,
      rateLimit: rateLimitBackend(),
      errorTracking: process.env.SENTRY_DSN ? "sentry" : "console",
    }, { headers: HEADERS });
  } catch (err) {
    log.error("health.db_unreachable", { area: "health", error: err });
    return Response.json({ status: "error", db: "down" }, { status: 503, headers: HEADERS });
  }
}
