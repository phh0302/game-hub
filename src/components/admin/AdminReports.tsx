"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";

type Status = "OPEN" | "RESOLVED" | "DISMISSED";
type Report = {
  id: string;
  reason: string;
  message: string | null;
  status: Status;
  resolution: string | null;
  createdAt: string;
  game: { id: string; slug: string; status: string; name: string; studio: string };
  reporter: string;
};

const STATUSES: Status[] = ["OPEN", "RESOLVED", "DISMISSED"];

/** Hàng chờ báo cáo vi phạm trong trang Quản trị */
export function AdminReports() {
  const t = useTranslations("adminReports");
  const tReport = useTranslations("report");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("OPEN");
  const [data, setData] = useState<{ reports: Report[]; counts: Partial<Record<Status, number>> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short" });

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await apiFetch(`/admin/reports?status=${status}&locale=${locale}`));
    } catch (err) {
      setError(t("loadError", { code: errorCode(err) }));
    }
  }, [status, locale, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(id: string, next: "RESOLVED" | "DISMISSED") {
    const resolution = window.prompt(t("notePrompt")) ?? undefined;
    try {
      await apiFetch(`/admin/reports/${id}`, { method: "PATCH", json: { status: next, resolution: resolution || undefined } });
      await load();
    } catch (err) {
      setError(t("loadError", { code: errorCode(err) }));
    }
  }

  const openCount = data?.counts.OPEN ?? 0;

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="font-display text-lg font-semibold">
          {t("title")}
          {openCount > 0 && (
            <span className="ml-2 rounded-full bg-neon-pink px-2 py-0.5 text-xs font-bold text-bg">{openCount}</span>
          )}
        </h2>
        <div role="tablist" className="flex rounded-lg border border-line p-0.5 text-xs font-semibold">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === status}
              onClick={() => setStatus(s)}
              className={`rounded-md px-2.5 py-1 ${s === status ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
            >
              {t(`status.${s}`)} ({data?.counts[s] ?? 0})
            </button>
          ))}
        </div>
      </header>

      {error && <p className="px-5 py-3 text-sm text-neon-pink">{error}</p>}
      {data && data.reports.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">{t("empty")}</p>}

      <ul className="divide-y divide-line/60">
        {data?.reports.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start gap-3 px-5 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p>
                <Link href={`/games/${r.game.slug}`} target="_blank" className="font-semibold hover:text-neon">
                  {r.game.name}
                </Link>{" "}
                <span className="text-xs text-muted">
                  · {r.game.studio} · {r.game.status}
                </span>
              </p>
              <p className="mt-0.5">
                <span className="rounded bg-neon-pink/15 px-1.5 py-0.5 text-xs font-semibold text-neon-pink">
                  {tReport(`reasons.${r.reason}`)}
                </span>{" "}
                <span className="text-xs text-muted">
                  {r.reporter} · {date.format(new Date(r.createdAt))}
                </span>
              </p>
              {r.message && <p className="mt-1 whitespace-pre-wrap text-muted">“{r.message}”</p>}
              {r.resolution && <p className="mt-1 text-xs text-neon-lime">{t("note")}: {r.resolution}</p>}
            </div>
            {r.status === "OPEN" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void resolve(r.id, "RESOLVED")}
                  className="rounded-md border border-neon-lime/50 px-2.5 py-1 text-xs font-semibold text-neon-lime hover:bg-neon-lime/10"
                >
                  {t("resolve")}
                </button>
                <button
                  type="button"
                  onClick={() => void resolve(r.id, "DISMISSED")}
                  className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink"
                >
                  {t("dismiss")}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-5 py-2 text-xs text-muted">{t("hint")}</p>
    </section>
  );
}
