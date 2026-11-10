"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";

type AdminUser = {
  id: string;
  displayName: string;
  username: string | null;
  walletAddress: string | null;
  role: "USER" | "ADMIN";
  createdAt: string;
  lastLoginAt: string | null;
  suspendedAt: string | null;
  suspendReason: string | null;
  activeSessions: number;
  scores: number;
};

/** Admin: tìm người dùng theo ví / tên → khóa (thu hồi mọi phiên, ẩn khỏi bảng xếp hạng) hoặc mở khóa */
export function AdminUsers() {
  const t = useTranslations("adminUsers");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short" });

  function errText(err: unknown) {
    const code = errorCode(err);
    return t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic", { code });
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setUser(null);
    try {
      setUser((await apiFetch<{ user: AdminUser }>(`/admin/users?q=${encodeURIComponent(q.trim())}`)).user);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function setSuspended(suspended: boolean) {
    if (!user) return;
    let reason: string | undefined;
    if (suspended) {
      const answer = window.prompt(t("reasonPrompt", { name: user.displayName }));
      if (answer === null) return;
      reason = answer.trim() || undefined;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ user: AdminUser }>(`/admin/users/${user.id}`, { method: "PATCH", json: { suspended, reason } });
      setUser(res.user);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="border-b border-line px-5 py-3">
        <h2 className="font-display text-lg font-semibold">{t("title")}</h2>
      </header>
      <form onSubmit={search} className="flex flex-wrap gap-2 px-5 py-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          required
          minLength={2}
          placeholder={t("placeholder")}
          className="min-w-64 flex-1 rounded-lg border border-line bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-neon"
        />
        <button type="submit" disabled={busy} className="rounded-lg border border-neon/60 px-4 py-2 text-sm font-semibold text-neon hover:bg-neon/10 disabled:opacity-60">
          {t("search")}
        </button>
      </form>

      {error && <p className="px-5 pb-4 text-sm text-neon-pink">{error}</p>}

      {user && (
        <div className="flex flex-wrap items-start gap-4 border-t border-line px-5 py-4 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {user.displayName}
              {user.role === "ADMIN" && <span className="ml-2 rounded bg-neon/15 px-1.5 py-0.5 text-xs text-neon">ADMIN</span>}
              {user.suspendedAt && (
                <span className="ml-2 rounded bg-neon-pink/15 px-1.5 py-0.5 text-xs font-semibold text-neon-pink">{t("suspended")}</span>
              )}
            </p>
            {user.walletAddress && <p className="break-all font-mono text-xs text-muted">{user.walletAddress}</p>}
            <p className="mt-1 text-xs text-muted">
              {t("stats", {
                created: date.format(new Date(user.createdAt)),
                lastLogin: user.lastLoginAt ? date.format(new Date(user.lastLoginAt)) : "—",
                sessions: user.activeSessions,
                scores: user.scores,
              })}
            </p>
            {user.suspendedAt && (
              <p className="mt-1 text-xs text-neon-pink">
                {t("suspendedInfo", { date: date.format(new Date(user.suspendedAt)), reason: user.suspendReason ?? "—" })}
              </p>
            )}
          </div>
          {user.role !== "ADMIN" &&
            (user.suspendedAt ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void setSuspended(false)}
                className="rounded-md border border-neon-lime/50 px-3 py-1.5 text-xs font-semibold text-neon-lime hover:bg-neon-lime/10 disabled:opacity-60"
              >
                {t("unsuspend")}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void setSuspended(true)}
                className="rounded-md border border-neon-pink/50 px-3 py-1.5 text-xs font-semibold text-neon-pink hover:bg-neon-pink/10 disabled:opacity-60"
              >
                {t("suspend")}
              </button>
            ))}
        </div>
      )}
      <p className="border-t border-line px-5 py-2 text-xs text-muted">{t("hint")}</p>
    </section>
  );
}
