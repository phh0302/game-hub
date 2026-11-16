"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";

type Tier = "FREE" | "PRO" | "BUSINESS";
type Metric = "projects" | "activePlayers" | "scores" | "openTournaments";
type StudioRow = {
  id: string;
  slug: string;
  name: string;
  isOfficial: boolean;
  plan: Tier;
  expiresAt: string | null;
  limits: Partial<Record<Metric, number | null>> | null;
  note: string | null;
  summary: { plan: Tier; expired: boolean; usage: { metric: Metric; used: number; limit: number | null; level: 80 | 100 | null }[] };
};

const METRICS: Metric[] = ["projects", "activePlayers", "scores", "openTournaments"];
const inputCls = "rounded-lg border border-line bg-bg px-2 py-1.5 text-sm outline-none focus:border-neon";

/** Admin: gán gói Platform API cho studio (khách beta / Business theo hợp đồng) – chưa thu tiền */
export function AdminPlans() {
  const t = useTranslations("adminPlans");
  const [studios, setStudios] = useState<StudioRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStudios((await apiFetch<{ studios: StudioRow[] }>("/admin/studios")).studios);
    } catch (err) {
      setError(t("error", { code: errorCode(err) }));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="border-b border-line px-5 py-3">
        <h2 className="font-display text-lg font-semibold">{t("title")}</h2>
        <p className="text-xs text-muted">{t("hint")}</p>
      </header>
      {error && <p className="px-5 py-3 text-sm text-neon-pink">{error}</p>}
      {studios && studios.length === 0 && <p className="px-5 py-4 text-sm text-muted">{t("empty")}</p>}
      <ul className="divide-y divide-line">
        {studios?.map((s) => (
          <StudioPlanRow key={s.id} studio={s} onSaved={load} />
        ))}
      </ul>
    </section>
  );
}

function StudioPlanRow({ studio, onSaved }: { studio: StudioRow; onSaved: () => Promise<void> }) {
  const t = useTranslations("adminPlans");
  const [plan, setPlan] = useState<Tier>(studio.plan);
  const [expires, setExpires] = useState(studio.expiresAt ? studio.expiresAt.slice(0, 10) : "");
  const [limits, setLimits] = useState<Record<Metric, string>>(() => {
    const l = studio.limits ?? {};
    return Object.fromEntries(
      METRICS.map((m) => [m, m in l ? (l[m] === null ? "∞" : String(l[m])) : ""]),
    ) as Record<Metric, string>;
  });
  const [note, setNote] = useState(studio.note ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const custom: Partial<Record<Metric, number | null>> = {};
      for (const m of METRICS) {
        const v = limits[m].trim();
        if (v === "") continue;
        custom[m] = v === "∞" ? null : Number(v);
      }
      await apiFetch(`/admin/studios/${studio.id}/plan`, {
        method: "PUT",
        json: {
          plan,
          expiresAt: expires ? new Date(`${expires}T23:59:59+07:00`).toISOString() : null,
          limits: Object.keys(custom).length ? custom : null,
          note: note.trim() || null,
        },
      });
      setMsg({ ok: true, text: t("saved") });
      await onSaved();
    } catch (err) {
      setMsg({ ok: false, text: t("error", { code: errorCode(err) }) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="px-5 py-4" data-testid={`studio-plan-${studio.slug}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {studio.name} <span className="font-mono text-xs text-muted">{studio.slug}</span>
        </p>
        <p className="text-xs text-muted">
          {studio.summary.usage
            .map((u) => `${t(`metrics.${u.metric}`)} ${u.used}/${u.limit === null ? "∞" : u.limit}${u.level ? ` (${u.level}%)` : ""}`)
            .join(" · ")}
          {studio.summary.expired && <span className="ml-2 text-neon-pink">{t("expired")}</span>}
        </p>
      </div>
      <form onSubmit={save} className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">{t("plan")}</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value as Tier)} className={inputCls} aria-label={`${t("plan")} ${studio.slug}`}>
            <option value="FREE">Free</option>
            <option value="PRO">Pro</option>
            <option value="BUSINESS">Business</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">{t("expiresAt")}</span>
          <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={inputCls} />
        </label>
        {METRICS.map((m) => (
          <label key={m} className="flex w-28 flex-col gap-1">
            <span className="text-xs text-muted">{t(`metrics.${m}`)}</span>
            <input
              value={limits[m]}
              onChange={(e) => setLimits((prev) => ({ ...prev, [m]: e.target.value }))}
              placeholder={t("default")}
              inputMode="numeric"
              pattern={"(\\d+|∞)?"}
              className={`${inputCls} w-full`}
              aria-label={`${t(`metrics.${m}`)} ${studio.slug}`}
            />
          </label>
        ))}
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-xs text-muted">{t("note")}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputCls} />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg border border-neon/60 px-4 py-1.5 text-sm font-semibold text-neon hover:bg-neon/10 disabled:opacity-60"
        >
          {t("save")}
        </button>
      </form>
      <p className="mt-1 text-xs text-muted">{t("limitsHint")}</p>
      {msg && <p className={`mt-1 text-sm ${msg.ok ? "text-neon-lime" : "text-neon-pink"}`}>{msg.text}</p>}
    </li>
  );
}
