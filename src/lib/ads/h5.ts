"use client";

import { outcomeFromStatus, parseAdsConfig, type AdKind, type AdOutcome } from "./config";

/** Cấu hình lúc build (Next.js nhúng NEXT_PUBLIC_* vào bundle) */
export const adsConfig = parseAdsConfig({
  client: process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
  test: process.env.NEXT_PUBLIC_ADS_TEST,
  frequency: process.env.NEXT_PUBLIC_ADS_FREQUENCY,
});

type PlacementInfo = { breakStatus?: string };
type AdBreakArgs = {
  type: string;
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (info: PlacementInfo) => void;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    adBreak?: (o: AdBreakArgs) => void;
    adConfig?: (o: Record<string, unknown>) => void;
  }
}

let state: "idle" | "loading" | "ready" | "blocked" = "idle";
let busy = false;

/** Nạp adsbygoogle.js một lần cho cả trang (gọi khi mở trang chơi game) */
export function loadAds(): void {
  if (!adsConfig || state !== "idle" || typeof document === "undefined") return;
  state = "loading";
  window.adsbygoogle = window.adsbygoogle || [];
  const push = (o: object) => {
    window.adsbygoogle!.push(o);
  };
  window.adBreak = push;
  window.adConfig = push;

  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsConfig.client)}`;
  s.dataset.adClient = adsConfig.client;
  s.dataset.adFrequencyHint = adsConfig.frequency;
  if (adsConfig.test) s.dataset.adbreakTest = "on";
  s.onload = () => {
    state = "ready";
  };
  // Trình chặn quảng cáo / mạng lỗi → báo NO_ADS ngay thay vì chờ
  s.onerror = () => {
    state = "blocked";
  };
  document.head.appendChild(s);
  window.adConfig!({ preloadAdBreaks: "on", sound: "on" });
}

export function adsAvailable(): boolean {
  return Boolean(adsConfig) && state !== "blocked";
}

/**
 * Hiện quảng cáo theo yêu cầu của game. Người chơi đã tự bấm "xem quảng cáo" trong game nên
 * gọi showAdFn() ngay khi Google báo có quảng cáo thưởng.
 * pause/resume: hub báo game dừng / chạy tiếp (tắt tiếng, dừng vòng lặp) quanh quảng cáo.
 */
export function showAd(kind: AdKind, name: string, hooks: { pause: () => void; resume: () => void }): Promise<AdOutcome> {
  if (!adsConfig) return Promise.resolve({ shown: false, rewarded: false, reason: "NO_ADS" });
  if (state === "blocked") return Promise.resolve({ shown: false, rewarded: false, reason: "BLOCKED" });
  if (busy) return Promise.resolve({ shown: false, rewarded: false, reason: "BUSY" });
  loadAds();
  busy = true;

  return new Promise<AdOutcome>((resolve) => {
    let viewed = false;
    let paused = false;
    let done = false;
    const finish = (o: AdOutcome) => {
      if (done) return;
      done = true;
      busy = false;
      clearTimeout(guard);
      if (paused) hooks.resume();
      resolve(o);
    };
    // Script không tải được / Google không trả lời → không giữ game chờ mãi
    const guard = setTimeout(() => {
      if (!paused) finish({ shown: false, rewarded: false, reason: state === "blocked" ? "BLOCKED" : "TIMEOUT" });
    }, 10_000);

    const args: AdBreakArgs = {
      type: kind === "rewarded" ? "reward" : "next",
      name: name.slice(0, 40) || kind,
      beforeAd: () => {
        paused = true;
        hooks.pause();
      },
      afterAd: () => {
        if (paused) {
          paused = false;
          hooks.resume();
        }
      },
      adBreakDone: (info) => finish(outcomeFromStatus(kind, info?.breakStatus, viewed)),
    };
    if (kind === "rewarded") {
      args.beforeReward = (showAdFn) => showAdFn();
      args.adViewed = () => {
        viewed = true;
      };
      args.adDismissed = () => {
        viewed = false;
      };
    }
    try {
      window.adBreak!(args);
    } catch {
      finish({ shown: false, rewarded: false, reason: "NO_ADS" });
    }
  });
}
