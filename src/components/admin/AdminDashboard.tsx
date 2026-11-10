"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";
import { AdminReports } from "./AdminReports";
import { AdminStats } from "./AdminStats";
import { AdminUsers } from "./AdminUsers";

const GAME_STATUSES = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "MAINTENANCE", "SUSPENDED", "ARCHIVED"] as const;
type GameStatus = (typeof GAME_STATUSES)[number];

type AdminVersion = {
  id: string;
  version: string;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  storageKey: string;
  entryFile: string;
  reviewNote: string | null;
  createdAt: string;
};

type AdminGame = {
  id: string;
  studio: { name: string; isOfficial: boolean };
  slug: string;
  status: GameStatus;
  currentVersionId: string | null;
  translations: { locale: string; name: string }[];
  categories: { category: { slug: string } }[];
  versions: AdminVersion[];
  _count: { sessions: number; scores: number };
};

type Category = { slug: string; name: string };

export function AdminDashboard() {
  const t = useTranslations("admin");
  const [games, setGames] = useState<AdminGame[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const reload = useCallback(async () => {
    try {
      const [g, c] = await Promise.all([
        apiFetch<{ games: AdminGame[] }>("/admin/games"),
        apiFetch<{ categories: Category[] }>("/categories"),
      ]);
      setGames(g.games);
      setCategories(c.categories);
    } catch (err) {
      setMessage({ kind: "error", text: t("errors.load", { code: errorCode(err) }) });
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Chạy 1 thao tác admin rồi tải lại danh sách */
  const run = useCallback(
    async (action: () => Promise<unknown>, okText: string) => {
      setMessage(null);
      try {
        await action();
        setMessage({ kind: "ok", text: okText });
        await reload();
        return true;
      } catch (err) {
        const code = errorCode(err);
        setMessage({ kind: "error", text: t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic", { code }) });
        return false;
      }
    },
    [reload, t],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.kind === "ok" ? "border-neon-lime/40 text-neon-lime" : "border-neon-pink/40 text-neon-pink"
          }`}
        >
          {message.text}
        </p>
      )}

      <AdminStats />
      <AdminReports />
      <AdminUsers />

      <CreateGameForm categories={categories} run={run} />

      {!games && <p className="text-muted">{t("loading")}</p>}
      {games?.length === 0 && <p className="text-muted">{t("noGames")}</p>}
      {games?.map((game) => <GameAdminCard key={game.id} game={game} run={run} />)}
    </div>
  );
}

type Run = (action: () => Promise<unknown>, okText: string) => Promise<boolean>;

function GameAdminCard({ game, run }: { game: AdminGame; run: Run }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const name =
    game.translations.find((tr) => tr.locale === locale)?.name ?? game.translations[0]?.name ?? game.slug;
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short" });

  const [version, setVersion] = useState("");
  const [storageKey, setStorageKey] = useState("");
  const keyPlaceholder = `games/${game.slug}/${version || "1.0.1"}`;

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {name} <span className="text-sm font-normal text-muted">/{game.slug}</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {game.studio.isOfficial ? "Game Hub" : `Studio: ${game.studio.name}`} ·{" "}
            {t("stats", { sessions: game._count.sessions, scores: game._count.scores })} ·{" "}
            {game.categories.map((c) => c.category.slug).join(", ") || "—"}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t("status")}</span>
          <select
            value={game.status}
            onChange={(e) =>
              void run(
                () => apiFetch(`/admin/games/${game.id}`, { method: "PATCH", json: { status: e.target.value } }),
                t("ok.statusChanged"),
              )
            }
            className="rounded-lg border border-line bg-bg px-2 py-1.5"
          >
            {GAME_STATUSES.filter((s) => s !== "ARCHIVED").map((s) => (
              <option key={s} value={s}>
                {t(`gameStatus.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="px-5 py-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">{t("versions")}</h3>
        {game.versions.length === 0 && <p className="text-sm text-muted">{t("noVersions")}</p>}
        {game.versions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line/60">
                {game.versions.map((v) => {
                  const current = v.id === game.currentVersionId;
                  return (
                    <tr key={v.id}>
                      <td className="py-2 pr-3 font-semibold">
                        v{v.version}
                        {current && (
                          <span className="ml-2 rounded bg-neon-lime/15 px-1.5 py-0.5 text-xs text-neon-lime">
                            {t("current")}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="text-xs">{t(`versionStatus.${v.status}`)}</span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted">
                        {v.storageKey}/{v.entryFile}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted">{date.format(new Date(v.createdAt))}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <a
                            href={`/preview/${v.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink"
                          >
                            {t("preview")}
                          </a>
                          {v.status !== "APPROVED" && (
                            <ActionButton
                              onClick={() =>
                                run(
                                  () =>
                                    apiFetch(`/admin/games/${game.id}/versions/${v.id}`, {
                                      method: "PATCH",
                                      json: { status: "APPROVED" },
                                    }),
                                  t("ok.approved"),
                                )
                              }
                            >
                              {t("approve")}
                            </ActionButton>
                          )}
                          {v.status !== "REJECTED" && !current && (
                            <ActionButton
                              danger
                              onClick={() => {
                                const note = window.prompt(t("rejectPrompt")) ?? undefined;
                                return run(
                                  () =>
                                    apiFetch(`/admin/games/${game.id}/versions/${v.id}`, {
                                      method: "PATCH",
                                      json: { status: "REJECTED", reviewNote: note || undefined },
                                    }),
                                  t("ok.rejected"),
                                );
                              }}
                            >
                              {t("reject")}
                            </ActionButton>
                          )}
                          {v.status === "APPROVED" && !current && (
                            <ActionButton
                              onClick={() =>
                                run(
                                  () =>
                                    apiFetch(`/admin/games/${game.id}/versions/${v.id}/activate`, { method: "POST" }),
                                  t("ok.activated"),
                                )
                              }
                            >
                              {t("activate")}
                            </ActionButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <form
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(
              () =>
                apiFetch(`/admin/games/${game.id}/versions`, {
                  method: "POST",
                  json: { version: version.trim(), storageKey: (storageKey.trim() || keyPlaceholder).trim() },
                }),
              t("ok.versionAdded"),
            );
            if (ok) {
              setVersion("");
              setStorageKey("");
            }
          }}
        >
          <Field label={t("versionName")}>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              required
              placeholder="1.0.1"
              className="w-28 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t("storageKey")}>
            <input
              value={storageKey}
              onChange={(e) => setStorageKey(e.target.value)}
              placeholder={keyPlaceholder}
              className="w-72 rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-sm"
            />
          </Field>
          <button type="submit" className="rounded-lg border border-neon/60 px-4 py-1.5 text-sm font-semibold text-neon hover:bg-neon/10">
            {t("addVersion")}
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">{t("storageHint")}</p>
      </div>
    </section>
  );
}

function CreateGameForm({ categories, run }: { categories: Category[]; run: Run }) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ slug: "", nameVi: "", nameEn: "", descVi: "", descEn: "", thumbnailKey: "" });
  const [picked, setPicked] = useState<string[]>([]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-lg bg-linear-to-r from-neon to-neon-pink px-5 py-2 font-semibold text-bg"
      >
        + {t("createGame")}
      </button>
    );
  }

  return (
    <form
      className="grid gap-4 rounded-2xl border border-neon/40 bg-surface p-5 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(
          () =>
            apiFetch("/admin/games", {
              method: "POST",
              json: {
                slug: form.slug.trim(),
                thumbnailKey: form.thumbnailKey.trim() || null,
                categorySlugs: picked,
                translations: [
                  { locale: "vi", name: form.nameVi.trim(), description: form.descVi.trim() || null },
                  { locale: "en", name: (form.nameEn || form.nameVi).trim(), description: form.descEn.trim() || null },
                ],
              },
            }),
          t("ok.gameCreated"),
        );
        if (ok) {
          setOpen(false);
          setForm({ slug: "", nameVi: "", nameEn: "", descVi: "", descEn: "", thumbnailKey: "" });
          setPicked([]);
        }
      }}
    >
      <h2 className="font-display text-xl font-semibold sm:col-span-2">{t("createGame")}</h2>
      <Field label="Slug">
        <input value={form.slug} onChange={set("slug")} required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="flappy-bird" className={inputCls} />
      </Field>
      <Field label={t("thumbnailKey")}>
        <input value={form.thumbnailKey} onChange={set("thumbnailKey")} placeholder="games/flappy-bird/thumbnail.png" className={`${inputCls} font-mono`} />
      </Field>
      <Field label={`${t("name")} (VI)`}>
        <input value={form.nameVi} onChange={set("nameVi")} required className={inputCls} />
      </Field>
      <Field label={`${t("name")} (EN)`}>
        <input value={form.nameEn} onChange={set("nameEn")} className={inputCls} />
      </Field>
      <Field label={`${t("description")} (VI)`}>
        <textarea value={form.descVi} onChange={set("descVi")} rows={2} className={inputCls} />
      </Field>
      <Field label={`${t("description")} (EN)`}>
        <textarea value={form.descEn} onChange={set("descEn")} rows={2} className={inputCls} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">{t("categories")}</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = picked.includes(c.slug);
            return (
              <button
                key={c.slug}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked((p) => (on ? p.filter((s) => s !== c.slug) : [...p, c.slug]))}
                className={`rounded-full border px-3 py-1 text-sm ${on ? "border-neon bg-neon/15 text-neon" : "border-line text-muted"}`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </fieldset>
      <p className="text-xs text-muted sm:col-span-2">{t("createHint")}</p>
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" className="rounded-lg bg-linear-to-r from-neon to-neon-pink px-5 py-2 font-semibold text-bg">
          {t("create")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-5 py-2 text-muted">
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

const inputCls = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-neon";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function ActionButton({
  onClick,
  danger,
  children,
}: {
  onClick: () => Promise<unknown>;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
      className={`rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${
        danger ? "border-neon-pink/50 text-neon-pink hover:bg-neon-pink/10" : "border-neon/50 text-neon hover:bg-neon/10"
      }`}
    >
      {children}
    </button>
  );
}
