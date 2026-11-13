import { timingSafeEqual } from "node:crypto";
import { ApiError, handle, ok } from "@/lib/api";
import { processDueWebhooks } from "@/modules/platform/webhooks";

/**
 * Cron (Vercel Cron, hằng ngày) gửi lại các webhook lỗi đã đến hạn mà chưa được gửi kèm sự kiện mới.
 * Vercel gửi header Authorization: Bearer <CRON_SECRET>. Chưa đặt CRON_SECRET → tắt.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    const given = req.headers.get("authorization") ?? "";
    const expected = `Bearer ${secret ?? ""}`;
    if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
      throw new ApiError(401, "UNAUTHORIZED", "Sai CRON_SECRET");
    }
    return ok(await processDueWebhooks({ limit: 100 }));
  });
}
