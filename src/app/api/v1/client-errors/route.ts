import { z } from "zod";
import { clientIp, handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring";

const schema = z.object({
  message: z.string().max(1000),
  name: z.string().max(100).optional(),
  stack: z.string().max(8000).optional(),
  digest: z.string().max(100).optional(),
  url: z.string().max(500).optional(),
  where: z.string().max(50).optional(),
});

/** Nhận lỗi giao diện từ trình duyệt → chuyển lên Sentry (giới hạn 10 lỗi/phút/IP chống spam) */
export async function POST(req: Request) {
  return handle(async () => {
    await rateLimit(`client-error:${clientIp(req)}`, 10, 60_000);
    const input = schema.parse(await readJson(req));
    const err = new Error(input.message || "(không có nội dung)");
    err.name = input.name || "ClientError";
    // Server lỗi đã được ghi qua onRequestError (có digest) – ở đây chỉ ghi lỗi phát sinh trên trình duyệt
    err.stack = input.stack ? `${err.name}: ${err.message}\n${input.stack.split("\n").slice(1).join("\n")}` : undefined;
    await reportError(err, {
      tags: { area: "client", where: input.where ?? "unknown" },
      request: { method: "GET", url: input.url },
      extra: { digest: input.digest, userAgent: req.headers.get("user-agent") ?? undefined },
    });
    return ok({ received: true });
  });
}
