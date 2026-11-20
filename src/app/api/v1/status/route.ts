import { after } from "next/server";
import { handle, ok } from "@/lib/api";
import { checkIfStale, getUptime, STALE_MS } from "@/modules/status/uptime";

export const dynamic = "force-dynamic";

/** Công khai cho monlabs.fun/status: lần kiểm tra gần nhất + uptime 90 ngày (không có dữ liệu nhạy cảm) */
export async function GET() {
  return handle(async () => {
    const data = await getUptime();
    // Lần kiểm tra gần nhất đã cũ (lịch GitHub bỏ lượt) → chạy kiểm tra sau khi trả lời, lần mở sau có số mới
    if (!data.last || Date.now() - data.last.at >= STALE_MS) after(() => checkIfStale());
    const res = ok(data);
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Cache-Control", "public, max-age=60");
    return res;
  });
}
