"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "./AuthProvider";
import { displayName } from "@/lib/format";

export function ConnectWalletButton() {
  const t = useTranslations("auth");
  const { user, status, error, login, logout, clearError } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi bấm ra ngoài
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (user) {
    return (
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold hover:border-neon/60"
        >
          <span className="size-2 rounded-full bg-neon-lime" aria-hidden />
          {displayName(user)}
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
            <Link href="/profile" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-surface-2">
              {t("profile")}
            </Link>
            {user.role === "ADMIN" && (
              <Link href="/admin" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-surface-2">
                {t("admin")}
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-neon-pink hover:bg-surface-2"
            >
              {t("logout")}
            </button>
          </div>
        )}
      </div>
    );
  }

  const busy = status !== "idle";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void login()}
        disabled={busy}
        className="rounded-lg border border-neon/60 px-4 py-2 text-sm font-semibold text-neon transition hover:bg-neon/10 disabled:opacity-60"
      >
        {status === "connecting" ? t("connecting") : status === "signing" ? t("signing") : t("connect")}
      </button>

      {error && (
        <div
          role="alert"
          className="absolute right-0 mt-2 w-72 rounded-xl border border-neon-pink/40 bg-surface p-4 text-sm shadow-xl"
        >
          <p className="text-ink">{t(`errors.${error}`)}</p>
          {error === "NO_WALLET" && (
            <div className="mt-3 flex flex-col gap-2">
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-neon px-3 py-2 text-center font-semibold text-bg"
              >
                {t("installMetaMask")}
              </a>
              <a
                href={`https://metamask.app.link/dapp/${typeof window !== "undefined" ? window.location.host + window.location.pathname : ""}`}
                className="rounded-lg border border-line px-3 py-2 text-center text-muted hover:text-ink"
              >
                {t("openInMetaMaskApp")}
              </a>
            </div>
          )}
          <button type="button" onClick={clearError} className="mt-3 text-xs text-muted hover:text-ink">
            {t("dismiss")}
          </button>
        </div>
      )}
    </div>
  );
}
