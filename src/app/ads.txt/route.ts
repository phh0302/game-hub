import { adsTxtLine, parseAdsConfig } from "@/lib/ads/config";

/** /ads.txt – khai báo tài khoản AdSense được bán quảng cáo trên domain (Google yêu cầu trước khi chạy quảng cáo) */
export function GET() {
  const cfg = parseAdsConfig({ client: process.env.NEXT_PUBLIC_ADSENSE_CLIENT });
  const body = cfg ? `${adsTxtLine(cfg.client)}\n` : "# Chưa bật quảng cáo\n";
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
