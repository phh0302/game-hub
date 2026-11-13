"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";
import { Section, useErrorText } from "./shared";

type Metric = "apiCalls" | "sessions" | "scores" | "rejected" | "activePlayers";
type Day = Record<Metric, number> & { day: string };
type Usage = { days: number; totals: Record<Metric, number>; series: Day[] };

const METRICS: Metric[] = ["activePlayers", "sessions", "scores", "rejected", "apiCalls"];

/** Số liệu Platform API: ô tổng + biểu đồ cột theo ngày (1 chỉ số, chọn bằng ô tổng) */
export function UsageStats({ gameId }: { gameId: string }) {
  const t = useTranslations("developer.usage");
  const locale = useLocale();
  const errorText = useErrorText();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [metric, setMetric] = useState<Metric>("activePlayers");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const num = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US");
  const dayFmt = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { day: "numeric", month: "short", timeZone: "UTC" });

  const load = useCallback(async () => {
    setError(null);
    try {
      setUsage(await apiFetch<Usage>(`/developer/games/${gameId}/usage?days=${days}`));
    } catch (err) {
      setError(errorText(errorCode(err)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const series = usage?.series ?? [];
  const max = Math.max(1, ...series.map((d) => d[metric]));
  const W = 600;
  const H = 140;
  const slot = series.length ? W / series.length : W;
  const barW = Math.max(2, slot - 2); // 2px khe giữa các cột
  const hovered = hover !== null ? series[hover] : null;

  return (
    <Section
      title={t("title")}
      aside={
        <div className="flex gap-1" role="group" aria-label={t("range")}>
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={`rounded-md px-2 py-1 text-xs ${days === d ? "bg-ink/10 text-ink" : "text-muted hover:text-ink"}`}
            >
              {t("days", { n: d })}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <p className="text-sm text-neon-pink">{error}</p>}
        <div data-testid="usage-totals" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {METRICS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metric === m}
              onClick={() => setMetric(m)}
              className={`rounded-lg border px-3 py-2 text-left ${
                metric === m ? "border-neon-lime/60 bg-neon-lime/5" : "border-line hover:border-ink/30"
              }`}
            >
              <span className="block text-xs text-muted">{t(`metrics.${m}`)}</span>
              <span className="block text-lg font-semibold tabular-nums text-ink">
                {usage ? num.format(usage.totals[m]) : "–"}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <p className="mb-1 h-5 text-xs text-muted" aria-live="polite">
            {hovered
              ? `${dayFmt.format(new Date(hovered.day))}: ${num.format(hovered[metric])} ${t(`metrics.${metric}`).toLowerCase()}`
              : t("chartHint", { metric: t(`metrics.${metric}`).toLowerCase() })}
          </p>
          <svg
            viewBox={`0 0 ${W} ${H + 18}`}
            className="h-auto w-full"
            role="img"
            aria-label={t("chartLabel", { metric: t(`metrics.${metric}`), days })}
            onMouseLeave={() => setHover(null)}
          >
            <line x1={0} x2={W} y1={H} y2={H} className="stroke-line" strokeWidth={1} />
            {series.map((d, i) => {
              const h = (d[metric] / max) * (H - 8);
              const x = i * slot + 1;
              return (
                <g key={d.day} onMouseEnter={() => setHover(i)}>
                  {/* Vùng bắt chuột cao hết biểu đồ – dễ trỏ hơn cột thấp */}
                  <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
                  {d[metric] > 0 && (
                    <path
                      d={roundedTop(x, H - h, barW, h, Math.min(4, barW / 2, h))}
                      className={hover === i ? "fill-neon-lime" : "fill-neon-lime/70"}
                    />
                  )}
                </g>
              );
            })}
            {series.length > 0 &&
              [0, series.length - 1].map((i) => (
                <text
                  key={i}
                  x={i === 0 ? 0 : W}
                  y={H + 14}
                  textAnchor={i === 0 ? "start" : "end"}
                  className="fill-muted text-[11px]"
                >
                  {dayFmt.format(new Date(series[i]!.day))}
                </text>
              ))}
          </svg>
        </div>
        <p className="text-xs text-muted">{t("note")}</p>
      </div>
    </Section>
  );
}

/** Cột bo 4px ở đầu, đáy vuông nằm trên trục */
function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}
