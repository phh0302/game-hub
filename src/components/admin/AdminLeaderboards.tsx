"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";
import { formatScore, type ScoreFormat } from "@/lib/score-format";

type GameOption = { id: string; slug: string; translations: { locale: string; name: string }[] };

type Board = {
  id: string;
  key: string;
  names: { vi: string | null; en: string | null };
  order: "ASC" | "DESC";
  startsAt: string | null;
  endsAt: string | null;
  status: "UPCOMING" | "OPEN" | "ENDED";
  mirrorOf: string | null;
  format: ScoreFormat;
  maxScore: number | null;
  minScore: number | null;
  maxScorePerSecond: number | null;
  scores: number;
  players: number;
};

type Form = {
  id?: string;
  key: string;
  nameVi: string;
  nameEn: string;
  kind: "event" | "separate";
  order: "DESC" | "ASC";
  startsAt: string;
  endsAt: string;
  maxScore: string;
  maxScorePerSecond: string;
};

const inputCls = "rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-neon";

/** "2026-11-20T20:00" (giờ máy admin) ↔ ISO */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

function slugify(v: string) {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function emptyForm(): Form {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return {
    key: "",
    nameVi: "",
    nameEn: "",
    kind: "event",
    order: "DESC",
    startsAt: toLocalInput(start.toISOString()),
    endsAt: toLocalInput(end.toISOString()),
    maxScore: "",
    maxScorePerSecond: "",
  };
}

/** Admin: bảng xếp hạng & giải đấu của từng game */
export function AdminLeaderboards({ games }: { games: GameOption[] }) {
  const t = useTranslations("adminBoards");
  const locale = useLocale();
  const [gameId, setGameId] = useState("");
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short" });
  const num = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US");

  useEffect(() => {
    if (!gameId && games[0]) setGameId(games[0].id);
  }, [games, gameId]);

  const errText = useCallback(
    (err: unknown) => {
      const code = errorCode(err);
      return t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic", { code });
    },
    [t],
  );

  const load = useCallback(async () => {
    if (!gameId) return;
    setBoards(null);
    try {
      setBoards((await apiFetch<{ leaderboards: Board[] }>(`/admin/games/${gameId}/leaderboards`)).leaderboards);
    } catch (err) {
      setMessage({ ok: false, text: errText(err) });
    }
  }, [gameId, errText]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: () => Promise<unknown>, okText: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: okText });
      setForm(null);
      await load();
    } catch (err) {
      setMessage({ ok: false, text: errText(err) });
    } finally {
      setBusy(false);
    }
  }

  function save(f: Form) {
    const names = { vi: f.nameVi.trim(), ...(f.nameEn.trim() ? { en: f.nameEn.trim() } : {}) };
    const limits =
      f.kind === "separate" || f.id
        ? {
            maxScore: f.maxScore ? Number(f.maxScore) : null,
            maxScorePerSecond: f.maxScorePerSecond ? Number(f.maxScorePerSecond) : null,
          }
        : {};
    if (f.id) {
      return act(
        () =>
          apiFetch(`/admin/leaderboards/${f.id}`, {
            method: "PATCH",
            json: { names: { vi: names.vi, en: f.nameEn.trim() || null }, startsAt: fromLocalInput(f.startsAt), endsAt: fromLocalInput(f.endsAt), ...limits },
          }),
        t("saved"),
      );
    }
    return act(
      () =>
        apiFetch(`/admin/games/${gameId}/leaderboards`, {
          method: "POST",
          json: {
            key: f.key,
            names,
            startsAt: fromLocalInput(f.startsAt),
            endsAt: fromLocalInput(f.endsAt),
            ...(f.kind === "event" ? { mirrorOf: "default" } : { order: f.order, ...limits }),
          },
        }),
      t("created"),
    );
  }

  const gameName = (g: GameOption) => g.translations.find((x) => x.locale === locale)?.name ?? g.translations[0]?.name ?? g.slug;

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="font-display text-lg font-semibold">{t("title")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label={t("game")} value={gameId} onChange={(e) => setGameId(e.target.value)} className={inputCls}>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {gameName(g)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setForm(emptyForm())}
            className="rounded-lg border border-neon/60 px-3 py-2 text-sm font-semibold text-neon hover:bg-neon/10"
          >
            + {t("create")}
          </button>
        </div>
      </header>

      {message && (
        <p role="status" className={`px-5 pt-3 text-sm ${message.ok ? "text-neon-lime" : "text-neon-pink"}`}>
          {message.text}
        </p>
      )}

      {form && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(form);
          }}
          className="grid gap-3 border-b border-line px-5 py-4 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("nameVi")}</span>
            <input
              required
              maxLength={80}
              value={form.nameVi}
              placeholder={t("namePlaceholder")}
              onChange={(e) =>
                setForm({ ...form, nameVi: e.target.value, ...(form.id ? {} : { key: slugify(e.target.value) }) })
              }
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("nameEn")}</span>
            <input maxLength={80} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className={inputCls} />
          </label>
          {!form.id && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t("key")}</span>
                <input
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  className={`${inputCls} font-mono`}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t("kind")}</span>
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Form["kind"] })} className={inputCls}>
                  <option value="event">{t("kindEvent")}</option>
                  <option value="separate">{t("kindSeparate")}</option>
                </select>
              </label>
            </>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("startsAt")}</span>
            <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("endsAt")}</span>
            <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className={inputCls} />
          </label>
          {(form.kind === "separate" || form.id) && (
            <>
              {!form.id && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{t("order")}</span>
                  <select value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value as Form["order"] })} className={inputCls}>
                    <option value="DESC">{t("orderDesc")}</option>
                    <option value="ASC">{t("orderAsc")}</option>
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t("maxScore")}</span>
                <input type="number" min={0} value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} className={inputCls} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t("maxScorePerSecond")}</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.maxScorePerSecond}
                  onChange={(e) => setForm({ ...form, maxScorePerSecond: e.target.value })}
                  className={inputCls}
                />
              </label>
            </>
          )}
          <p className="text-xs text-muted sm:col-span-2">
            {form.id ? t("editHint") : form.kind === "event" ? t("eventHint") : t("separateHint", { key: form.key || "…" })}
          </p>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="rounded-lg bg-neon px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60">
              {form.id ? t("save") : t("create")}
            </button>
            <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink">
              {t("cancel")}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-5 py-2 font-medium">{t("col.board")}</th>
              <th className="px-3 py-2 font-medium">{t("col.status")}</th>
              <th className="px-3 py-2 font-medium">{t("col.time")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("col.players")}</th>
              <th className="px-5 py-2 text-right font-medium">{t("col.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {boards?.map((b) => (
              <tr key={b.id}>
                <td className="px-5 py-2.5">
                  <p className="font-semibold">{b.names[locale === "vi" ? "vi" : "en"] ?? b.names.vi ?? (b.key === "default" ? t("main") : b.key)}</p>
                  <p className="font-mono text-xs text-muted">
                    {b.key}
                    {b.mirrorOf && ` ← ${b.mirrorOf}`} · {b.order === "ASC" ? t("orderAsc") : t("orderDesc")}
                    {b.maxScore !== null && ` · ≤ ${formatScore(b.maxScore, b.format, locale)}`}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                      b.status === "OPEN" ? "bg-neon-lime/15 text-neon-lime" : b.status === "UPCOMING" ? "bg-neon/15 text-neon" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {t(`status.${b.status}`)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted">
                  {b.startsAt || b.endsAt
                    ? `${b.startsAt ? date.format(new Date(b.startsAt)) : "…"} → ${b.endsAt ? date.format(new Date(b.endsAt)) : "…"}`
                    : t("always")}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {num.format(b.players)} <span className="text-xs text-muted">({num.format(b.scores)})</span>
                </td>
                <td className="px-5 py-2.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setForm({
                          id: b.id,
                          key: b.key,
                          nameVi: b.names.vi ?? "",
                          nameEn: b.names.en ?? "",
                          kind: b.mirrorOf ? "event" : "separate",
                          order: b.order,
                          startsAt: toLocalInput(b.startsAt),
                          endsAt: toLocalInput(b.endsAt),
                          maxScore: b.maxScore?.toString() ?? "",
                          maxScorePerSecond: b.maxScorePerSecond?.toString() ?? "",
                        })
                      }
                      className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
                    >
                      {t("edit")}
                    </button>
                    {b.status === "OPEN" && b.key !== "default" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void act(() => apiFetch(`/admin/leaderboards/${b.id}`, { method: "PATCH", json: { endsAt: new Date().toISOString() } }), t("ended"))
                        }
                        className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
                      >
                        {t("endNow")}
                      </button>
                    )}
                    {b.key !== "default" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(t("confirmDelete", { name: b.names.vi ?? b.key }))) {
                            void act(() => apiFetch(`/admin/leaderboards/${b.id}`, { method: "DELETE" }), t("deleted"));
                          }
                        }}
                        className="rounded-md border border-neon-pink/50 px-2 py-1 text-xs text-neon-pink hover:bg-neon-pink/10"
                      >
                        {t("delete")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!boards && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-muted">
                  {t("loading")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-5 py-2 text-xs text-muted">{t("hint")}</p>
    </section>
  );
}
