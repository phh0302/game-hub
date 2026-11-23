"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export type ShareRequest = {
  kind: "share" | "invite";
  title: string;
  text: string;
  url: string;
  /** Có thì gửi SHARE_RESULT về game khi đóng */
  requestId?: string;
};
export type ShareOutcome = { shared: boolean; method: "native" | "copy" | "facebook" | "x" | "telegram" | null };

/**
 * Bảng chia sẻ nằm đè lên khung game (vẫn thấy khi game đang toàn màn hình).
 * Điện thoại: nút "Chia sẻ…" mở bảng chia sẻ của máy (Zalo, Messenger…); mọi nơi: copy link, Facebook, X, Telegram.
 */
export function ShareSheet({ request, onClose }: { request: ShareRequest; onClose: (outcome: ShareOutcome) => void }) {
  const t = useTranslations("share");
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const canNative = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const full = `${request.text} ${request.url}`;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose({ shared: false, method: null });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function native() {
    try {
      await navigator.share({ title: request.title, text: request.text, url: request.url });
      onClose({ shared: true, method: "native" });
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") void copy();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
    } catch {
      // Trình duyệt chặn clipboard → chọn sẵn ô link để người chơi tự copy
      const input = document.getElementById("share-sheet-url") as HTMLInputElement | null;
      input?.select();
    }
  }

  const links: { method: ShareOutcome["method"]; label: string; href: string }[] = [
    { method: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(request.url)}` },
    { method: "x", label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(request.text)}&url=${encodeURIComponent(request.url)}` },
    { method: "telegram", label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(request.url)}&text=${encodeURIComponent(request.text)}` },
  ];

  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center bg-bg/70 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose({ shared: copied, method: copied ? "copy" : null })}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sheet-title"
        data-testid="share-sheet"
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="share-sheet-title" className="font-display text-lg font-semibold">
            {request.kind === "invite" ? t("inviteTitle") : t("sheetTitle")}
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onClose({ shared: copied, method: copied ? "copy" : null })}
            aria-label={t("close")}
            className="-mr-1 -mt-1 rounded-md px-2 py-1 text-lg leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">{request.text}</p>

        <div className="mt-4 flex gap-2">
          <input
            id="share-sheet-url"
            readOnly
            value={request.url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="shrink-0 rounded-lg border border-neon/60 px-3 py-2 text-sm font-semibold text-neon hover:bg-neon/10"
          >
            {copied ? `✓ ${t("copied")}` : t("copy")}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {canNative && (
            <button
              type="button"
              onClick={() => void native()}
              className="rounded-lg bg-linear-to-r from-neon to-neon-pink px-3 py-1.5 text-sm font-semibold text-bg"
            >
              {t("more")}
            </button>
          )}
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onClose({ shared: true, method: l.method })}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>
        {request.kind === "invite" && <p className="mt-3 text-xs text-muted">{t("inviteHint")}</p>}
      </div>
    </div>
  );
}
