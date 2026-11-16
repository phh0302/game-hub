"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch } from "@/lib/client-api";
import { Section } from "./shared";

type Metric = "projects" | "activePlayers" | "scores" | "openTournaments";
type Summary = {
  plan: "FREE" | "PRO" | "BUSINESS";
  assignedPlan: "FREE" | "PRO" | "BUSINESS";
  expired: boolean;
  expiresAt: string | null;
  month: string;
  limits: { serverApi: boolean; webhooks: boolean; branding: boolean };
  usage: { metric: Metric; used: number; limit: number | null; level: 80 | 100 | null }[];
};

const PRICING_URL = "https://monlabs.fun/#pricing";

/** Gói Platform API + mức dùng tháng này; cảnh báo ở 80% / 100% */
export function PlanUsage() {
  const t = useTranslations("developer.plan");
  const locale = useLocale();
  const [s, setS] = useState<Summary | null>(null);
  const num = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US");
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium" });

  useEffect(() => {
    apiFetch<Summary>("/developer/plan")
      .then(setS)
      .catch(() => setS(null));
  }, []);

  if (!s) return null;
  const over = s.usage.filter((u) => u.level === 100);
  const near = s.usage.filter((u) => u.level === 80);

  return (
    <Section
      title={t("title")}
      aside={
        <a href={PRICING_URL} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-ink">
          {t("pricing")} ↗
        </a>
      }
    >
      <div data-testid="plan-usage" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="rounded-md bg-neon-lime/15 px-2 py-0.5 text-sm font-semibold text-neon-lime">
            {t(`tiers.${s.plan}`)}
          </span>
          {s.expired && <span className="text-xs text-neon-pink">{t("expired", { plan: t(`tiers.${s.assignedPlan}`) })}</span>}
          {!s.expired && s.expiresAt && (
            <span className="text-xs text-muted">{t("expiresAt", { date: date.format(new Date(s.expiresAt)) })}</span>
          )}
          <span className="text-xs text-muted">{t("month", { month: s.month })}</span>
        </div>

        {over.length > 0 && (
          <p role="alert" className="rounded-lg border border-neon-pink/50 bg-neon-pink/5 p-3 text-sm text-neon-pink">
            ✕ {t("overBanner", { items: over.map((u) => t(`metrics.${u.metric}`)).join(", ") })}
          </p>
        )}
        {over.length === 0 && near.length > 0 && (
          <p role="status" className="rounded-lg border border-yellow-400/50 bg-yellow-400/5 p-3 text-sm text-yellow-300">
            ⚠ {t("nearBanner", { items: near.map((u) => t(`metrics.${u.metric}`)).join(", ") })}
          </p>
        )}

        <ul className="grid gap-3 sm:grid-cols-2">
          {s.usage.map((u) => {
            const pct = u.limit === null ? 0 : u.limit === 0 ? 100 : Math.min(100, Math.round((u.used / u.limit) * 100));
            const bar = u.level === 100 ? "bg-neon-pink" : u.level === 80 ? "bg-yellow-400" : "bg-neon-lime";
            return (
              <li key={u.metric} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>{t(`metrics.${u.metric}`)}</span>
                  <span className="tabular-nums text-muted">
                    {num.format(u.used)} / {u.limit === null ? t("unlimited") : num.format(u.limit)}
                    {u.level !== null && <span className="ml-1 font-medium text-ink">({u.level === 100 ? "100%" : `${pct}%`})</span>}
                  </span>
                </div>
                {u.limit !== null && (
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-line"
                    role="progressbar"
                    aria-label={t(`metrics.${u.metric}`)}
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-muted">
          {s.limits.serverApi ? t("featuresPaid") : t("featuresFree")} {t("note")}
        </p>
      </div>
    </Section>
  );
}
