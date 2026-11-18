import { handle, ok } from "@/lib/api";
import { getUptime } from "@/modules/status/uptime";

export const dynamic = "force-dynamic";

/** Công khai cho monlabs.fun/status: lần kiểm tra gần nhất + uptime 90 ngày (không có dữ liệu nhạy cảm) */
export async function GET() {
  return handle(async () => {
    const res = ok(await getUptime());
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Cache-Control", "public, max-age=60");
    return res;
  });
}
