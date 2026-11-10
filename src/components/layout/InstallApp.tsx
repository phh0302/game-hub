"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * Đăng ký service worker (chỉ bản production) + nút "Cài app".
 * Android / máy tính (Chrome, Edge): bấm là hiện hộp cài đặt của trình duyệt.
 * iPhone / iPad (Safari không có hộp cài đặt): hiện hướng dẫn Chia sẻ → Thêm vào Màn hình chính.
 */
export function InstallApp() {
  const t = useTranslations("pwa");
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    // Trình duyệt trong app MetaMask cũng là WebView iOS nhưng không cài được → chỉ gợi ý trên Safari thật
    const ua = navigator.userAgent;
    setIos(/iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios|metamask/i.test(ua));

    const onPrompt = (e: Event) => {
      e.preventDefault(); // tự hiện nút của hub thay cho thanh gợi ý mặc định
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt && !ios) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            await prompt.userChoice.catch(() => undefined);
            setPrompt(null);
          } else {
            setShowHelp((v) => !v);
          }
        }}
        className="rounded-lg border border-neon/50 px-3 py-1.5 text-xs font-semibold text-neon hover:bg-neon/10"
      >
        ⬇ {t("install")}
      </button>
      {showHelp && (
        <p role="status" className="absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 rounded-lg border border-line bg-surface p-3 text-left text-xs text-ink shadow-xl">
          {t("iosHelp")}
        </p>
      )}
    </div>
  );
}
