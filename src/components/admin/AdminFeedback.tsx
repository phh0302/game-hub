"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";

type Status = "OPEN" | "DONE";
type Item = {
  id: string;
  category: "BUG" | "IDEA" | "OTHER";
  message: string;
  email: string | null;
  page: string | null;
  status: Status;
  emailed: boolean;
  createdAt: string;
  user: string | null;
};

const STATUSES: Status[] = ["OPEN", "DONE"];

/** Góp ý từ trang /contact trong trang Quản trị */
export function AdminFeedback() {
  const t = useTranslations("adminFeedback");
  const tc = useTranslations("contact");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("OPEN");
  const [data, setData] = useState<{ items: Item[]; counts: Partial<Record<Status, number>> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short" });

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await apiFetch(`/admin/feedback?status=${status}`));
    } catch (err) {
      setError(t("loadError", { code: errorCode(err) }));
    }
  }, [status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mark(id: string, next: Status) {
    try {
      await apiFetch(`/admin/feedback/${id}`, { method: "PATCH", json: { status: next } });
      await load();
    } catch (err) {
      setError(t("loadError", { code: errorCode(err) }));
    }
  }

  const openCount = data?.counts.OPEN ?? 0;

  return (
    <section data-testid="admin-feedback" className="rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="font-display text-lg font-semibold">
          {t("title")}
          {openCount > 0 && <span className="ml-2 rounded-full bg-neon px-2 py-0.5 text-xs font-bold text-bg">{openCount}</span>}
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
      {data && data.items.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">{t("empty")}</p>}

      <ul className="divide-y divide-line/60">
        {data?.items.map((f) => (
          <li key={f.id} className="flex flex-wrap items-start gap-3 px-5 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-neon/15 px-1.5 py-0.5 text-xs font-semibold text-neon">{tc(`categories.${f.category}`)}</span>
                <span className="text-xs text-muted">
                  {f.user ?? t("guest")} · {date.format(new Date(f.createdAt))}
                  {f.page ? ` · ${f.page}` : ""}
                  {f.emailed ? ` · ${t("emailed")}` : ""}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-wrap">{f.message}</p>
              {f.email && (
                <a href={`mailto:${f.email}`} className="mt-1 inline-block text-xs text-neon hover:underline">
                  {t("reply")}: {f.email}
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => void mark(f.id, f.status === "OPEN" ? "DONE" : "OPEN")}
              className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink"
            >
              {f.status === "OPEN" ? t("markDone") : t("reopen")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
