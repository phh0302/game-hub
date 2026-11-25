"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ApiClientError, apiFetch, errorCode } from "@/lib/client-api";
import { formatBytes, uploadFile } from "@/lib/upload-client";
import { MAX_IMAGE_BYTES, MAX_UPLOAD_BYTES } from "@/modules/uploads/limits";
import {
  Field,
  ghostBtn,
  inputCls,
  nextVersion,
  primaryBtn,
  Section,
  StatusBadge,
  useErrorText,
  type GameStatus,
  type VersionStatus,
} from "./shared";
import { PlatformLog } from "./PlatformLog";
import { GameEvents } from "./GameEvents";
import { UsageStats } from "./UsageStats";
import { WebhookSettings } from "./WebhookSettings";
import { ApiIntegration } from "./ApiIntegration";

type Version = {
  id: string;
  version: string;
  status: VersionStatus;
  reviewNote: string | null;
  releaseNotes: string | null;
  sizeBytes: number | null;
  createdAt: string;
  isCurrent: boolean;
};

type Game = {
  id: string;
  slug: string;
  name: string;
  status: GameStatus;
  translations: { locale: string; name: string; description: string | null }[];
  categorySlugs: string[];
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  versions: Version[];
  currentVersionId: string | null;
  allowedOrigins: string[];
  scoreSubmission: "client" | "server";
  stats: { sessions: number; players: number; scores: number };
  rules: Rules;
};

type Rules = {
  minPlaySeconds: number;
  maxSessionHours: number;
  scoreSubmission: "client" | "server";
  leaderboards: {
    key: string;
    name: string | null;
    order: "ASC" | "DESC";
    startsAt: string | null;
    endsAt: string | null;
    format: "number" | "duration_ms";
    minScore: number | null;
    maxScore: number | null;
    maxScorePerSecond: number | null;
    mirrorOf: string | null;
  }[];
  rejected30d?: { reason: string; count: number }[];
  rejected24h?: number;
  /** Ngưỡng cảnh báo (máy chủ quyết định, mặc định 20) */
  rejectWarnAt?: number;
};

export function DeveloperGame({ gameId }: { gameId: string }) {
  const t = useTranslations("developer");
  const errorText = useErrorText();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGame((await apiFetch<{ game: Game }>(`/developer/games/${gameId}`)).game);
    } catch (err) {
      setError(errorText(errorCode(err)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="text-neon-pink">{error}</p>;
  if (!game) return <p className="text-muted">{t("loading")}</p>;

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-muted">
        <Link href="/developer" className="hover:text-ink">
          ← {t("backToStudio")}
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold">{game.name}</h1>
            <StatusBadge status={game.status} kind="game" />
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t(`statusHelp.${game.status}`)}</p>
        </div>
        {game.status === "PUBLISHED" && (
          <Link href={`/games/${game.slug}`} className={ghostBtn}>
            {t("viewOnHub")} →
          </Link>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["sessions", "players", "scores"] as const).map((k) => (
          <div key={k} className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted">{t(`stats.${k}`)}</p>
            <p className="font-display text-2xl font-bold tabular-nums">{game.stats[k].toLocaleString()}</p>
          </div>
        ))}
      </div>

      <UploadVersion game={game} onDone={load} />
      {(game.rules.rejected24h ?? 0) >= (game.rules.rejectWarnAt ?? 20) && <RejectWarning rules={game.rules} />}
      <VersionList game={game} onChanged={load} />
      <GameRules rules={game.rules} />
      <GameEvents gameId={game.id} />
      <GameInfoForm game={game} onSaved={setGame} />
      <ApiIntegration gameId={game.id} origins={game.allowedOrigins} scoreSubmission={game.scoreSubmission} />
      <UsageStats gameId={game.id} />
      <WebhookSettings gameId={game.id} />
      <PlatformLog gameId={game.id} />
    </div>
  );
}

type UploadState =
  | { step: "idle" }
  | { step: "uploading"; percent: number }
  | { step: "processing" }
  | { step: "done"; files: number; cover?: string | null }
  | { step: "error"; message: string };

function UploadVersion({ game, onDone }: { game: Game; onDone: () => void }) {
  const t = useTranslations("developer");
  const errorText = useErrorText();
  const fileRef = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState(nextVersion(game.versions[0]?.version));
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({ step: "idle" });
  const busy = state.step === "uploading" || state.step === "processing";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setState({ step: "error", message: errorText("FILE_TOO_LARGE") });
      return;
    }
    try {
      setState({ step: "uploading", percent: 0 });
      const uploadKey = await uploadFile(file, "build", (percent) => setState({ step: "uploading", percent }));
      setState({ step: "processing" });
      const { version: created } = await apiFetch<{ version: { files: number; autoCover?: { path: string } | null } }>(`/developer/games/${game.id}/versions`, {
        method: "POST",
        json: { version: version.trim(), uploadKey, releaseNotes: notes.trim() || undefined },
      });
      setState({ step: "done", files: created.files, cover: created.autoCover?.path ?? null });
      setFile(null);
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
      onDone();
    } catch (err) {
      // Lỗi kiểm tra zip có kèm chi tiết (vd: tên file không được phép)
      setState({ step: "error", message: errorText(errorCode(err), err instanceof ApiClientError ? err.message : undefined) });
    }
  }

  return (
    <Section title={t("uploadTitle")}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <Field label={t("versionName")}>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            required
            maxLength={30}
            pattern="[0-9A-Za-z][0-9A-Za-z._\-]*"
            placeholder="1.0.0"
            className={`${inputCls} font-mono`}
          />
        </Field>
        <Field label={t("buildFile")} hint={t("buildHint")}>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip"
            required
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-ink"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("releaseNotes")}>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} className={inputCls} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <button type="submit" disabled={busy || !file} className={primaryBtn}>
            {t("submitVersion")}
          </button>
          {state.step === "uploading" && (
            <div className="flex min-w-60 flex-1 items-center gap-3 text-sm text-muted">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-linear-to-r from-neon to-neon-pink transition-all" style={{ width: `${state.percent}%` }} />
              </div>
              {t("uploading", { percent: state.percent })}
            </div>
          )}
          {state.step === "processing" && <span className="text-sm text-neon">{t("processing")}</span>}
          {state.step === "done" && (
            <span className="text-sm text-neon-lime">
              {t("uploadDone", { files: state.files })}
              {state.cover ? ` · ${t("autoCoverDone", { path: state.cover })}` : ""}
            </span>
          )}
          {state.step === "error" && <span role="alert" className="text-sm text-neon-pink">{state.message}</span>}
        </div>
      </form>
    </Section>
  );
}

function VersionList({ game, onChanged }: { game: Game; onChanged: () => void }) {
  const t = useTranslations("developer");
  const locale = useLocale();
  const errorText = useErrorText();
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Developer tự đổi bản chạy (rollback) sau khi game đã phát hành; game bị khóa / lưu trữ thì không
  const canSwitch = Boolean(game.currentVersionId) && game.status !== "SUSPENDED" && game.status !== "ARCHIVED";
  const current = game.versions.find((v) => v.isCurrent);

  async function activate(v: Version) {
    if (!window.confirm(t("activateConfirm", { version: v.version, current: current?.version ?? "–" }))) return;
    setBusy(v.id);
    setMessage(null);
    try {
      await apiFetch(`/developer/games/${game.id}/versions/${v.id}/activate`, { method: "POST" });
      setMessage({ ok: true, text: t("activated", { version: v.version }) });
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: errorText(errorCode(err)) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title={t("versions")}>
      {game.versions.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">{t("noVersions")}</p>
      ) : (
        <ul className="divide-y divide-line/60">
          {game.versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">v{v.version}</span>
                  <StatusBadge status={v.status} kind="version" />
                  {v.isCurrent && (
                    <span className="rounded bg-neon-lime/15 px-1.5 py-0.5 text-xs text-neon-lime">{t("live")}</span>
                  )}
                  <span className="text-xs text-muted">
                    {formatBytes(v.sizeBytes)} · {date.format(new Date(v.createdAt))}
                  </span>
                </div>
                {v.releaseNotes && <p className="mt-1 text-sm text-muted">{v.releaseNotes}</p>}
                {v.status === "REJECTED" && v.reviewNote && (
                  <p className="mt-1 rounded-md border border-neon-pink/40 bg-neon-pink/10 px-3 py-2 text-sm text-neon-pink">
                    {t("rejectReason")}: {v.reviewNote}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {canSwitch && v.status === "APPROVED" && !v.isCurrent && (
                  <button type="button" className={ghostBtn} disabled={busy !== null} onClick={() => void activate(v)}>
                    {busy === v.id ? "…" : t("activate")}
                  </button>
                )}
                <a href={`/preview/${v.id}`} target="_blank" rel="noreferrer" className={ghostBtn}>
                  {t("preview")} ↗
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p role="status" className={`mt-2 text-sm ${message.ok ? "text-neon-lime" : "text-neon-pink"}`}>
          {message.text}
        </p>
      )}
      {canSwitch && <p className="mt-2 text-xs text-muted">{t("activateHint")}</p>}
    </Section>
  );
}

function GameInfoForm({ game, onSaved }: { game: Game; onSaved: (g: Game) => void }) {
  const t = useTranslations("developer");
  const tAdmin = useTranslations("admin");
  const locale = useLocale();
  const errorText = useErrorText();
  const tr = (l: string) => game.translations.find((x) => x.locale === l);
  const [form, setForm] = useState({
    nameVi: tr("vi")?.name ?? "",
    nameEn: tr("en")?.name ?? "",
    descVi: tr("vi")?.description ?? "",
    descEn: tr("en")?.description ?? "",
  });
  const [picked, setPicked] = useState<string[]>(game.categorySlugs);
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);
  const [thumb, setThumb] = useState<{ key: string | null; url: string | null }>({ key: game.thumbnailKey, url: game.thumbnailUrl });
  const [thumbBusy, setThumbBusy] = useState(false);
  const [state, setState] = useState<{ busy: boolean; ok?: boolean; error?: string }>({ busy: false });
  const [autoMsg, setAutoMsg] = useState<string | null>(null);

  // Upload bản build xong, hub tự lấy ảnh bìa → hiện luôn (khi developer chưa tự chọn ảnh)
  useEffect(() => {
    if (game.thumbnailKey) setThumb((t) => (t.key ? t : { key: game.thumbnailKey, url: game.thumbnailUrl }));
  }, [game.thumbnailKey, game.thumbnailUrl]);

  async function autoCover() {
    setThumbBusy(true);
    setAutoMsg(null);
    try {
      const { cover } = await apiFetch<{ cover: { thumbnailKey: string; thumbnailUrl: string; from: string } }>(
        `/developer/games/${game.id}/cover/auto`,
        { method: "POST" },
      );
      setThumb({ key: cover.thumbnailKey, url: cover.thumbnailUrl });
      setAutoMsg(t("autoCoverDone", { path: cover.from }));
      onSaved({ ...game, thumbnailKey: cover.thumbnailKey, thumbnailUrl: cover.thumbnailUrl });
    } catch (err) {
      setAutoMsg(errorCode(err) === "NO_COVER_IN_BUILD" ? t("autoCoverNone") : errorText(errorCode(err)));
    } finally {
      setThumbBusy(false);
    }
  }

  useEffect(() => {
    apiFetch<{ categories: { slug: string; name: string }[] }>(`/categories?locale=${locale}`)
      .then((r) => setCategories(r.categories))
      .catch(() => undefined);
  }, [locale]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onThumb(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setState({ busy: false, error: errorText("FILE_TOO_LARGE") });
      return;
    }
    setThumbBusy(true);
    try {
      const key = await uploadFile(file, "image");
      setThumb({ key, url: URL.createObjectURL(file) });
      setState({ busy: false });
    } catch (err) {
      setState({ busy: false, error: errorText(errorCode(err)) });
    } finally {
      setThumbBusy(false);
    }
  }

  return (
    <Section title={t("gameInfo")}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setState({ busy: true });
          try {
            const { game: saved } = await apiFetch<{ game: Game }>(`/developer/games/${game.id}`, {
              method: "PATCH",
              json: {
                thumbnailKey: thumb.key,
                categorySlugs: picked,
                translations: [
                  { locale: "vi", name: form.nameVi.trim(), description: form.descVi.trim() || null },
                  { locale: "en", name: (form.nameEn || form.nameVi).trim(), description: form.descEn.trim() || null },
                ],
              },
            });
            onSaved(saved);
            setState({ busy: false, ok: true });
          } catch (err) {
            setState({ busy: false, error: errorText(errorCode(err)) });
          }
        }}
      >
        <div className="flex items-center gap-4 sm:col-span-2">
          <div className="aspect-video w-48 overflow-hidden rounded-lg border border-line bg-surface-2">
            {thumb.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb.url} alt="" className="size-full object-cover" />
            )}
          </div>
          <Field label={t("thumbnail")} hint={t("thumbnailHint")}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={thumbBusy}
              onChange={(e) => void onThumb(e.target.files?.[0])}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-ink"
            />
            {!thumb.key && game.versions.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => void autoCover()}
                  disabled={thumbBusy}
                  className="self-start rounded-md border border-neon/50 px-2.5 py-1 text-xs font-semibold text-neon hover:bg-neon/10 disabled:opacity-60"
                >
                  {t("autoCover")}
                </button>
                <span className="text-xs text-muted">{t("autoCoverHint")}</span>
              </div>
            )}
            {autoMsg && <p className="mt-1 text-xs text-muted">{autoMsg}</p>}
          </Field>
        </div>
        <Field label={`${tAdmin("name")} (VI)`}>
          <input value={form.nameVi} onChange={set("nameVi")} required maxLength={100} className={inputCls} />
        </Field>
        <Field label={`${tAdmin("name")} (EN)`}>
          <input value={form.nameEn} onChange={set("nameEn")} maxLength={100} className={inputCls} />
        </Field>
        <Field label={`${tAdmin("description")} (VI)`}>
          <textarea value={form.descVi} onChange={set("descVi")} rows={3} maxLength={2000} className={inputCls} />
        </Field>
        <Field label={`${tAdmin("description")} (EN)`}>
          <textarea value={form.descEn} onChange={set("descEn")} rows={3} maxLength={2000} className={inputCls} />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">{tAdmin("categories")}</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = picked.includes(c.slug);
              return (
                <button
                  key={c.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((p) => (on ? p.filter((s) => s !== c.slug) : p.length < 5 ? [...p, c.slug] : p))}
                  className={`rounded-full border px-3 py-1 text-sm ${on ? "border-neon bg-neon/15 text-neon" : "border-line text-muted"}`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={state.busy || thumbBusy} className={primaryBtn}>
            {state.busy ? t("saving") : t("save")}
          </button>
          {state.ok && <span className="text-sm text-neon-lime">{t("saved")}</span>}
          {state.error && <span role="alert" className="text-sm text-neon-pink">{state.error}</span>}
        </div>
      </form>
    </Section>
  );
}

/** Luật chấm điểm do admin đặt – chỉ xem. Luật sai khiến điểm thật bị từ chối → developer cần thấy để báo admin. */
function GameRules({ rules }: { rules: Rules }) {
  const t = useTranslations("developer.rules");
  const locale = useLocale();
  const num = (v: number) => v.toLocaleString(locale === "vi" ? "vi-VN" : "en-US");
  const date = (v: string) => new Date(v).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US");
  const none = t("none");
  return (
    <Section title={t("title")}>
      <p className="mb-3 text-sm text-muted">{t("hint")}</p>
      <dl className="mb-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3" data-testid="game-rules">
        <div>
          <dt className="text-muted">{t("minPlay")}</dt>
          <dd className="font-semibold tabular-nums">{rules.minPlaySeconds ? t("seconds", { n: rules.minPlaySeconds }) : none}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("maxSession")}</dt>
          <dd className="font-semibold tabular-nums">{t("hours", { n: rules.maxSessionHours })}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("submission")}</dt>
          <dd className="font-semibold">{t(`submissionValue.${rules.scoreSubmission}`)}</dd>
        </div>
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="py-1 pr-4">{t("board")}</th>
              <th className="py-1 pr-4">{t("order")}</th>
              <th className="py-1 pr-4">{t("range")}</th>
              <th className="py-1 pr-4">{t("speed")}</th>
              <th className="py-1">{t("time")}</th>
            </tr>
          </thead>
          <tbody>
            {rules.leaderboards.map((b) => (
              <tr key={b.key} className="border-t border-line/60">
                <td className="py-2 pr-4">
                  <code className="font-mono text-xs">{b.key}</code>
                  {b.name && <span className="ml-2 text-muted">{b.name}</span>}
                  {b.mirrorOf && <span className="ml-2 text-xs text-muted">{t("mirror", { key: b.mirrorOf })}</span>}
                </td>
                <td className="py-2 pr-4">
                  {t(b.order === "DESC" ? "desc" : "asc")}
                  {b.format === "duration_ms" && <span className="text-muted"> · {t("duration")}</span>}
                </td>
                <td className="py-2 pr-4 tabular-nums">
                  {b.minScore === null && b.maxScore === null
                    ? none
                    : `${num(b.minScore ?? 0)} – ${b.maxScore === null ? "∞" : num(b.maxScore)}`}
                </td>
                <td className="py-2 pr-4 tabular-nums">
                  {b.maxScorePerSecond === null ? none : t("perSecond", { n: num(b.maxScorePerSecond) })}
                </td>
                <td className="py-2 tabular-nums">
                  {b.startsAt || b.endsAt ? `${b.startsAt ? date(b.startsAt) : "…"} → ${b.endsAt ? date(b.endsAt) : "…"}` : t("always")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4" data-testid="rejected-30d">
        <h3 className="text-sm font-semibold">{t("rejectedTitle")}</h3>
        {!rules.rejected30d || rules.rejected30d.length === 0 ? (
          <p className="text-sm text-muted">{t("rejectedNone")}</p>
        ) : (
          <>
            <ul className="mt-1 flex flex-wrap gap-2 text-sm">
              {rules.rejected30d.map((r) => (
                <li key={r.reason} className="rounded-md border border-neon-pink/40 px-2 py-0.5">
                  <code className="font-mono text-xs">{r.reason}</code> <span className="tabular-nums">× {num(r.count)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted">{t("rejectedHint")}</p>
          </>
        )}
      </div>
    </Section>
  );
}

/** Khung cảnh báo: nhiều điểm bị từ chối trong 24 giờ – thường do luật chưa khớp cách chơi thật */
function RejectWarning({ rules }: { rules: Rules }) {
  const t = useTranslations("developer.rules");
  const top = rules.rejected30d?.[0]?.reason ?? "";
  return (
    <div role="alert" data-testid="reject-warning" className="rounded-2xl border border-neon-pink/50 bg-neon-pink/10 px-5 py-4 text-sm">
      <p className="font-semibold text-neon-pink">{t("warnTitle", { count: rules.rejected24h ?? 0 })}</p>
      <p className="mt-1 text-muted">{t("warnBody", { reason: top })}</p>
    </div>
  );
}
