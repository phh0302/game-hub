import { handle, ok } from "@/lib/api";
import { checkAndRecord } from "@/modules/status/uptime";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Chạy kiểm tra trạng thái. Công khai nhưng vô hại: tối đa 1 lần / 4 phút (khóa Redis), không nhận tham số.
 * GitHub Actions (.github/workflows/uptime.yml) gọi mỗi 10 phút.
 */
export async function POST() {
  return handle(async () => {
    const res = ok(await checkAndRecord());
    res.headers.set("Cache-Control", "no-store");
    return res;
  });
}
