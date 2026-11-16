import { timingSafeEqual } from "node:crypto";
import { ApiError, handle, ok } from "@/lib/api";
import { runRetentionCleanup } from "@/modules/maintenance/cleanup";
import { processDueWebhooks } from "@/modules/platform/webhooks";

/**
 * Cron hằng ngày (vercel.json): gửi lại webhook lỗi đến hạn + dọn dữ liệu quá hạn giữ.
 * Vercel gửi Authorization: Bearer <CRON_SECRET>. Chưa đặt CRON_SECRET → tắt.
 */
export const maxDuration = 60;

export async function GET(req: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    const given = req.headers.get("authorization") ?? "";
    const expected = `Bearer ${secret ?? ""}`;
    if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
      throw new ApiError(401, "UNAUTHORIZED", "Sai CRON_SECRET");
    }
    const webhooks = await processDueWebhooks({ limit: 100 });
    const cleanup = await runRetentionCleanup();
    return ok({ webhooks, cleanup });
  });
}
