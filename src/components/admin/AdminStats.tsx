"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";

type Day = { date: string; newUsers: number; sessions: number; anonymousPlays: number; players: number };
type Stats = {
  days: number;
  totals: {
    users: number;
    newUsers: number;
    players: number;
    plays: number;
    anonymousPlays: number;
    scores: number;
    rejected: number;
    openReports: number;
  };
  daily: Day[];
  perGame: {
    slug: string;
    name: string;
    status: string;
    plays: number;
    anonymousPlays: number;
    players: number;
    scores: number;
    avgSeconds: number | null;
  }[];
};

const RANGES = [7, 30, 90] as const;

/** Tổng quan cho admin: người chơi mới, lượt chơi theo ngày, game được chơi nhiều nhất */
export function AdminStats() {
  const t = useTranslations("adminStats");
  const locale = useLocale();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tag = locale === "vi" ? "vi-VN" : "en-US";
  const num = new Intl.NumberFormat(tag);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    apiFetch<Stats>(`/admin/stats?days=${days}`)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(t("loadError", { code: errorCode(err) })));
    return () => {
      cancelled = true;
    };
  }, [days, t]);

  const day = (iso: string) =>
    new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="font-display text-lg font-semibold">{t("title")}</h2>
        <div role="tablist" className="flex rounded-lg border border-line p-0.5 text-xs font-semibold">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={r === days}
              onClick={() => setDays(r)}
              className={`rounded-md px-2.5 py-1 ${r === days ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
            >
              {t("range", { days: r })}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="px-5 py-4 text-sm text-neon-pink">{error}</p>}
      {!data && !error && <p className="px-5 py-6 text-sm text-muted">{t("loading")}</p>}

      {data && (
        <div className={`flex flex-col gap-6 px-5 py-5 ${data.days !== days ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label={t("kpi.plays")} value={num.format(data.totals.plays)} hint={t("kpi.playsHint", { guests: num.format(data.totals.anonymousPlays) })} />
            <Kpi label={t("kpi.players")} value={num.format(data.totals.players)} hint={t("kpi.playersHint")} />
            <Kpi label={t("kpi.newUsers")} value={num.format(data.totals.newUsers)} hint={t("kpi.usersHint", { total: num.format(data.totals.users) })} />
            <Kpi
              label={t("kpi.scores")}
              value={num.format(data.totals.scores)}
              hint={t("kpi.rejectedHint", { rejected: num.format(data.totals.rejected), reports: num.format(data.totals.openReports) })}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <BarChart
              title={t("chart.plays")}
              data={data.daily.map((d) => ({ label: day(d.date), value: d.sessions + d.anonymousPlays }))}
              format={(v) => num.format(v)}
              unit={t("unit.plays")}
              empty={t("empty")}
            />
            <BarChart
              title={t("chart.newUsers")}
              data={data.daily.map((d) => ({ label: day(d.date), value: d.newUsers }))}
              format={(v) => num.format(v)}
              unit={t("unit.users")}
              empty={t("empty")}
            />
          </div>

          <div className="overflow-x-auto">
            <h3 className="mb-2 text-sm font-semibold text-muted">{t("perGame")}</h3>
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">{t("col.game")}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t("col.plays")}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t("col.players")}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t("col.scores")}</th>
                  <th className="py-2 text-right font-medium">{t("col.avg")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {data.perGame.map((g) => (
                  <tr key={g.slug}>
                    <td className="py-2 pr-3">
                      <a href={`/games/${g.slug}`} target="_blank" rel="noreferrer" className="font-semibold hover:text-neon">
                        {g.name}
                      </a>
                      {g.status !== "PUBLISHED" && <span className="ml-2 text-xs text-muted">{g.status}</span>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {num.format(g.plays)}
                      {g.anonymousPlays > 0 && <span className="ml-1 text-xs text-muted">({t("guests", { n: num.format(g.anonymousPlays) })})</span>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{num.format(g.players)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{num.format(g.scores)}</td>
                    <td className="py-2 text-right tabular-nums">{g.avgSeconds === null ? "–" : duration(g.avgSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">{t("note")}</p>
        </div>
      )}
    </section>
  );
}

function duration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg/40 px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

/** Biểu đồ cột 1 chuỗi: cột mảnh bo 4px phía trên, lưới mờ, rê chuột / chạm để xem số của từng ngày */
function BarChart({
  title,
  data,
  format,
  unit,
  empty,
}: {
  title: string;
  data: { label: string; value: number }[];
  format: (v: number) => string;
  unit: string;
  empty: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 170;
  const PAD = { top: 10, right: 4, bottom: 22, left: 36 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = niceCeil(max);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / data.length;
  const barW = Math.max(2, Math.min(18, slot - 2));
  const y = (v: number) => PAD.top + plotH - (v / niceMax) * plotH;
  const total = data.reduce((s, d) => s + d.value, 0);
  const active = hover !== null ? data[hover] : null;
  const ticks = [0, niceMax / 2, niceMax];
  const labelIdx = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);

  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{title}</span>
        <span className="tabular-nums text-muted">
          {active ? `${active.label}: ${format(active.value)} ${unit}` : `Σ ${format(total)} ${unit}`}
        </span>
      </figcaption>
      {total === 0 ? (
        <p className="grid h-[170px] place-items-center rounded-xl border border-dashed border-line text-sm text-muted">{empty}</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${title}: ${format(total)} ${unit}`} onMouseLeave={() => setHover(null)}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-line" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="currentColor" className="text-muted">
                {format(v)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const top = y(d.value);
            const h = PAD.top + plotH - top;
            const r = Math.min(4, barW / 2, h);
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                {/* Vùng bắt chuột cao hết biểu đồ – dễ trỏ hơn cột mảnh */}
                <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent" />
                {d.value > 0 && (
                  <path
                    d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`}
                    fill="#22e3ff"
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                )}
                {labelIdx.has(i) && (
                  <text x={PAD.left + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="currentColor" className="text-muted">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </figure>
  );
}

/** Làm tròn trục lên số "đẹp": 7 → 8, 37 → 40, 230 → 250 */
function niceCeil(v: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return Math.max(2, nice * exp);
}
