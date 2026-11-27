/**
 * Cấu hình quảng cáo Google H5 Games Ads (Ad Placement API) – đọc từ biến môi trường lúc build.
 * - NEXT_PUBLIC_ADSENSE_CLIENT="ca-pub-1234567890123456" → bật quảng cáo (chưa đặt / sai định dạng → tắt)
 * - NEXT_PUBLIC_ADS_TEST="1" → chế độ thử của Google (data-adbreak-test="on"): quảng cáo mẫu, không tính tiền
 * - NEXT_PUBLIC_ADS_FREQUENCY="120s" → khoảng cách tối thiểu giữa 2 quảng cáo xen giữa (gợi ý cho Google)
 */
export const ADSENSE_CLIENT_RE = /^ca-pub-\d{10,20}$/;

export type AdsConfig = { client: string; test: boolean; frequency: string } | null;

export function parseAdsConfig(env: { client?: string; test?: string; frequency?: string }): AdsConfig {
  const client = env.client?.trim() ?? "";
  if (!ADSENSE_CLIENT_RE.test(client)) return null;
  const frequency = /^\d{2,4}s$/.test(env.frequency?.trim() ?? "") ? env.frequency!.trim() : "120s";
  return { client, test: env.test === "1" || env.test === "true", frequency };
}

/** Dòng ads.txt cho tài khoản AdSense (pub-… = ca-pub-… bỏ tiền tố "ca-") */
export function adsTxtLine(client: string): string {
  return `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0`;
}

/** Trạng thái placement của Google → kết quả trả cho game */
export type AdKind = "rewarded" | "interstitial";
export type AdOutcome = { shown: boolean; rewarded: boolean; reason?: string };

export function outcomeFromStatus(kind: AdKind, breakStatus: string | undefined, viewed: boolean): AdOutcome {
  const status = breakStatus ?? "error";
  if (status === "viewed") return { shown: true, rewarded: kind === "rewarded" && viewed };
  if (status === "dismissed") return { shown: true, rewarded: false, reason: "SKIPPED" };
  if (status === "frequencyCapped") return { shown: false, rewarded: false, reason: "FREQUENCY_CAPPED" };
  if (status === "noAdPreloaded" || status === "other") return { shown: false, rewarded: false, reason: "NO_FILL" };
  return { shown: false, rewarded: false, reason: status === "timeout" ? "TIMEOUT" : "NO_ADS" };
}

/** Tên sự kiện đếm lượt quảng cáo (game không tự gửi được tiền tố "hub.") */
export const AD_STATUSES = ["viewed", "dismissed", "nofill", "error"] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

export function adStatusOf(o: AdOutcome): AdStatus {
  if (o.shown) return o.reason === "SKIPPED" ? "dismissed" : "viewed";
  return o.reason === "NO_FILL" || o.reason === "FREQUENCY_CAPPED" ? "nofill" : "error";
}

export function adEventName(kind: AdKind, status: AdStatus): string {
  return `hub.ad.${kind}.${status}`;
}
