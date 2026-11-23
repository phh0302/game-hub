"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";
import { BarChart, Kpi } from "./AdminStats";
import { AdminTrafficBlocks } from "./AdminTrafficBlocks";

type Range = "1h" | "24h" | "7d" | "30d";
const RANGES: Range[] = ["1h", "24h", "7d", "30d"];

type Overview = {
  now: number;
  stats: {
    range: Range;
    step: "minute" | "hour" | "day";
    source: "redis" | "database" | "none";
    sampleRate: number | null;
    series: { t: number; requests: number; errors: number; clientErrors: number; blocked: number }[];
    totals: { requests: number; errors: number; clientErrors: number; blocked: number; errorRate: number | null };
    latency: { p50: number | null; p95: number | null; p99: number | null };
    groups: { name: string; requests: number }[];
    routes: { name: string; requests: number }[];
    slowRoutes?: { name: string; avgMs: number; samples: number; errors: number }[];
    topIps: { ipHash: string; requests: number }[];
    blockedCodes: { code: string; count: number }[];
  };
  anomalies: { id: string; type: string; at: number; message: string; alerted: boolean }[];
  telegram: { tokenSet: boolean; chatId: string | null; chatFromEnv: boolean };
};

/** Trang theo dõi lưu lượng (stats.monlabs.fun): request theo thời gian, lỗi, bị chặn, độ trễ, bất thường, Telegram */
export function TrafficDashboard() {
  const t = useTranslations("trafficStats");
  const locale = useLocale();
  const tag = locale === "vi" ? "vi-VN" : "en-US";
  const num = new Intl.NumberFormat(tag);
  const [range, setRange] = useState<Range>("24h");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Overview>(`/admin/traffic/stats?range=${range}`));
      setError(null);
    } catch (err) {
      setError(t("loadError", { code: errorCode(err) }));
    }
  }, [range, t]);

  useEffect(() => {
    void load();
    // Tự làm mới mỗi 30 giây khi xem 1 giờ / 24 giờ
    if (range !== "1h" && range !== "24h") return;
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load, range]);

  async function telegram(action: "discover" | "test") {
    setMsg(null);
    try {
      const res = await apiFetch<{ chat?: { title: string } }>("/admin/traffic/telegram", {
        method: "POST",
        json: { action },
      });
      setMsg(action === "discover" ? t("telegram.found", { name: res.chat?.title ?? "" }) : t("telegram.sent"));
      await load();
    } catch (err) {
      setMsg(t("telegram.error", { code: errorCode(err) }));
    }
  }

  const s = data?.stats;
  const fmtTime = (ms: number) => {
    const d = new Date(ms);
    if (s?.step === "minute") return new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit" }).format(d);
    if (s?.step === "hour")
      return new Intl.DateTimeFormat(tag, range === "24h" ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", hour: "2-digit" }).format(d);
    return new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(d);
  };
  const when = new Intl.DateTimeFormat(tag, { dateStyle: "short", timeStyle: "short" });
  const ms = (v: number | null) => (v === null ? "–" : v >= 10_000 ? "> 5 s" : `≤ ${num.format(v)} ms`);

  return (
    <div className="space-y-6" data-testid="traffic-dashboard">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted">
            {s?.source === "database"
              ? t("sourceDb")
              : s?.sampleRate
                ? t("sampled", { pct: Math.round(s.sampleRate * 100) })
                : t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" className="flex rounded-lg border border-line p-0.5 text-xs font-semibold">
            {RANGES.map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={range === r}
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1.5 ${range === r ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
              >
                {t(`range.${r}`)}
              </button>
            ))}
          </div>
          <button onClick={() => void load()} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink">
            {t("refresh")}
          </button>
        </div>
      </header>

      {error && <p className="text-sm text-neon-pink">{error}</p>}
      {!data && !error && <p className="text-sm text-muted">{t("loading")}</p>}

      {s && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="traffic-kpis">
            <Kpi label={t("kpi.requests")} value={num.format(s.totals.requests)} hint={t("kpi.requestsHint")} />
            <Kpi
              label={t("kpi.errorRate")}
              value={s.totals.errorRate === null ? "–" : `${(s.totals.errorRate * 100).toFixed(1)}%`}
              hint={t("kpi.errorsHint", { errors: num.format(s.totals.errors), client: num.format(s.totals.clientErrors) })}
            />
            <Kpi label={t("kpi.blocked")} value={num.format(s.totals.blocked)} hint={t("kpi.blockedHint")} />
            <Kpi label={t("kpi.latency")} value={ms(s.latency.p95)} hint={t("kpi.latencyHint", { p50: ms(s.latency.p50) })} />
          </div>

          <section className="grid gap-6 rounded-2xl border border-line bg-surface p-5 lg:grid-cols-2">
            <BarChart
              title={t("chart.requests")}
              data={s.series.map((p) => ({ label: fmtTime(p.t), value: p.requests }))}
              format={(v) => num.format(v)}
              unit={t("unit.requests")}
              empty={t("empty")}
            />
            <BarChart
              title={t("chart.errors")}
              data={s.series.map((p) => ({ label: fmtTime(p.t), value: p.errors }))}
              format={(v) => num.format(v)}
              unit={t("unit.requests")}
              empty={t("emptyErrors")}
              color="#ff3ec8"
            />
            <BarChart
              title={t("chart.blocked")}
              data={s.series.map((p) => ({ label: fmtTime(p.t), value: p.blocked }))}
              format={(v) => num.format(v)}
              unit={t("unit.requests")}
              empty={t("emptyBlocked")}
              color="#b6ff3b"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TopList title={t("top.groups")} rows={s.groups.map((g) => [t.has(`group.${g.name}`) ? t(`group.${g.name}`) : g.name, g.requests])} num={num} empty={t("empty")} />
              <TopList title={t("top.blocked")} rows={s.blockedCodes.map((c) => [c.code, c.count])} num={num} empty={t("emptyBlocked")} />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <TopList title={t("top.routes")} rows={s.routes.map((r) => [r.name, r.requests])} num={num} empty={t("empty")} mono />
            </div>
            <div className="rounded-2xl border border-line bg-surface p-5">
              <TopList title={t("top.ips")} rows={s.topIps.map((r) => [r.ipHash, r.requests])} num={num} empty={t("emptyIps")} mono />
              <p className="mt-2 text-xs text-muted">{t("ipsHint")}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="mb-1 text-sm font-semibold">{t("slow.title")}</h3>
            <p className="mb-3 text-xs text-muted">{t("slow.hint")}</p>
            {(s.slowRoutes ?? []).length === 0 ? (
              <p className="text-sm text-muted">{t("empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="py-1 pr-3 font-medium">{t("slow.route")}</th>
                      <th className="py-1 pr-3 text-right font-medium">{t("slow.avg")}</th>
                      <th className="py-1 pr-3 text-right font-medium">{t("slow.samples")}</th>
                      <th className="py-1 text-right font-medium">{t("slow.errors")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(s.slowRoutes ?? []).map((r) => (
                      <tr key={r.name} className="border-t border-line/60">
                        <td className="max-w-[22rem] truncate py-1.5 pr-3 font-mono text-xs">{r.name}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{num.format(r.avgMs)} ms</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-muted">{num.format(r.samples)}</td>
                        <td className={`py-1.5 text-right tabular-nums ${r.errors > 0 ? "text-red-400" : "text-muted"}`}>{num.format(r.errors)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {data && (
        <section className="rounded-2xl border border-line bg-surface" data-testid="traffic-anomalies">
          <header className="border-b border-line px-5 py-3">
            <h2 className="font-display text-lg font-semibold">{t("anomalies.title")}</h2>
            <p className="text-xs text-muted">{t("anomalies.hint")}</p>
          </header>
          {data.anomalies.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">{t("anomalies.empty")}</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {data.anomalies.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 text-sm">
                  <span className="rounded-md border border-neon-pink/40 px-1.5 py-0.5 text-xs font-semibold text-neon-pink">
                    {t.has(`anomalyType.${a.type}`) ? t(`anomalyType.${a.type}`) : a.type}
                  </span>
                  <span className="flex-1">{a.message}</span>
                  <span className="text-xs tabular-nums text-muted">
                    {when.format(new Date(a.at))}
                    {a.alerted ? ` · ${t("anomalies.alerted")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {data && (
        <section className="rounded-2xl border border-line bg-surface px-5 py-4" data-testid="traffic-telegram">
          <h2 className="font-display text-lg font-semibold">{t("telegram.title")}</h2>
          <p className="mt-1 text-sm text-muted">
            {!data.telegram.tokenSet
              ? t("telegram.noToken")
              : data.telegram.chatId
                ? t("telegram.ready", { chat: data.telegram.chatId })
                : t("telegram.noChat")}
          </p>
          {data.telegram.tokenSet && (
            <div className="mt-3 flex flex-wrap gap-2">
              {!data.telegram.chatFromEnv && (
                <button onClick={() => void telegram("discover")} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:border-neon">
                  {t("telegram.discover")}
                </button>
              )}
              {data.telegram.chatId && (
                <button onClick={() => void telegram("test")} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:border-neon">
                  {t("telegram.test")}
                </button>
              )}
            </div>
          )}
          {msg && <p className="mt-2 text-sm text-neon">{msg}</p>}
        </section>
      )}

      {data && <AdminTrafficBlocks />}
    </div>
  );
}

function TopList({
  title,
  rows,
  num,
  empty,
  mono,
}: {
  title: string;
  rows: [string, number][];
  num: Intl.NumberFormat;
  empty: string;
  mono?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map(([name, v]) => (
            <li key={name}>
              <div className="flex justify-between gap-3">
                <span className={`truncate ${mono ? "font-mono text-xs leading-5" : ""}`}>{name}</span>
                <span className="tabular-nums text-muted">{num.format(v)}</span>
              </div>
              <div className="mt-0.5 h-1 rounded-full bg-line/50">
                <div className="h-1 rounded-full bg-neon/70" style={{ width: `${(v / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
