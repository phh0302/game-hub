import { prisma } from "@/lib/prisma";
import { rateLimitBackend } from "@/lib/rate-limit";

// Kiểm tra web + database còn sống (dùng cho uptime monitor sau khi deploy)
export const dynamic = "force-dynamic";

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
    });
  } catch (err) {
    console.error("[health] Database không phản hồi:", err);
    return Response.json({ status: "error", db: "down" }, { status: 503 });
  }
}
