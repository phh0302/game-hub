"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";
import { BarChart } from "@/components/admin/AdminStats";
import { Section } from "./shared";

type Stats = {
  days: { date: string; total: number }[];
  events: { name: string; total: number; today: number }[];
  recent: { name: string; props: Record<string, unknown> | null; at: number; source: string }[];
};

/** Sự kiện game gửi qua GameHub.track: tổng theo ngày, theo tên, 50 sự kiện gần nhất (để kiểm tra tích hợp) */
export function GameEvents({ gameId }: { gameId: string }) {
  const t = useTranslations("developer.events");
  const locale = useLocale();
  const tag = locale === "vi" ? "vi-VN" : "en-US";
  const num = new Intl.NumberFormat(tag);
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Stats>(`/developer/games/${gameId}/analytics?days=${days}`));
      setError(null);
    } catch (err) {
      setError(errorCode(err));
    }
  }, [gameId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const short = new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const when = new Intl.DateTimeFormat(tag, { dateStyle: "short", timeStyle: "medium" });
  const max = Math.max(1, ...(data?.events ?? []).map((e) => e.total));

  return (
    <Section title={t("title")}>
      <div data-testid="game-events">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">{t("hint")}</p>
          <div className="flex items-center gap-2">
            <div role="tablist" className="flex rounded-lg border border-line p-0.5 text-xs font-semibold">
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  role="tab"
                  aria-selected={days === d}
                  onClick={() => setDays(d)}
                  className={`rounded-md px-3 py-1 ${days === d ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
                >
                  {t("days", { n: d })}
                </button>
              ))}
            </div>
            <button onClick={() => void load()} className="rounded-lg border border-line px-3 py-1 text-xs font-semibold text-muted hover:text-ink">
              {t("refresh")}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-neon-pink">{t("error", { code: error })}</p>}

        {data && data.events.length === 0 && (
          <div className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
            <p>{t("empty")}</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-bg/60 p-3 font-mono text-xs text-ink">
              {`GameHub.track("level_complete", { level: 3 });\nGameHub.track("ad_rewarded");`}
            </pre>
          </div>
        )}

        {data && data.events.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <BarChart
              title={t("perDay")}
              data={data.days.map((d) => ({ label: short.format(new Date(`${d.date}T00:00:00Z`)), value: d.total }))}
              format={(v) => num.format(v)}
              unit={t("unit")}
              empty={t("empty")}
            />
            <div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="py-1 pr-3">{t("name")}</th>
                    <th className="py-1 pr-3 text-right">{t("total", { n: days })}</th>
                    <th className="py-1 text-right">{t("today")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.slice(0, 30).map((e) => (
                    <tr key={e.name} className="border-t border-line/60">
                      <td className="py-1.5 pr-3">
                        <code className="font-mono text-xs">{e.name}</code>
                        <div className="mt-1 h-1 rounded-full bg-line/50">
                          <div className="h-1 rounded-full bg-neon/70" style={{ width: `${(e.total / max) * 100}%` }} />
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{num.format(e.total)}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted">{num.format(e.today)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data && data.recent.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold">{t("recent", { n: data.recent.length })}</summary>
            <ul className="mt-2 max-h-72 divide-y divide-line/60 overflow-y-auto text-xs">
              {data.recent.map((r, i) => (
                <li key={`${r.at}-${i}`} className="flex flex-wrap gap-x-3 py-1.5">
                  <span className="tabular-nums text-muted">{when.format(new Date(r.at))}</span>
                  <code className="font-mono">{r.name}</code>
                  {r.props && <code className="font-mono text-muted">{JSON.stringify(r.props)}</code>}
                  <span className="text-muted">{r.source === "api" ? t("sourceApi") : t("sourceHub")}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Section>
  );
}
