"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";
import { Field, inputCls, primaryBtn, ghostBtn, Section, slugify, StatusBadge, useErrorText, type GameStatus, type VersionStatus } from "./shared";
import { StudioMembers } from "./StudioMembers";

type Studio = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  myRole: "OWNER" | "MEMBER";
  termsUpToDate: boolean;
};
type DevGame = {
  id: string;
  slug: string;
  name: string;
  status: GameStatus;
  thumbnailUrl: string | null;
  versions: { id: string; version: string; status: VersionStatus }[];
  stats: { sessions: number; players: number; scores: number };
};

const SDK_DOCS_URL = "https://docs.monlabs.fun/sdk";

export function DeveloperHome() {
  const t = useTranslations("developer");
  const [studio, setStudio] = useState<Studio | null | undefined>(undefined);
  const [games, setGames] = useState<DevGame[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const errorText = useErrorText();

  const load = useCallback(async () => {
    try {
      const { studio: s } = await apiFetch<{ studio: Studio | null }>("/developer/studio");
      setStudio(s);
      if (s) setGames((await apiFetch<{ games: DevGame[] }>("/developer/games")).games);
    } catch (err) {
      setLoadError(errorText(errorCode(err)));
    }
  }, [errorText]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadError) return <p className="text-neon-pink">{loadError}</p>;
  if (studio === undefined) return <p className="text-muted">{t("loading")}</p>;
  if (studio === null) return <Onboarding onCreated={load} />;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{t("studio")}</p>
          <h1 className="font-display text-3xl font-bold">{studio.name}</h1>
          {studio.description && <p className="mt-1 text-sm text-muted">{studio.description}</p>}
        </div>
        <a href={SDK_DOCS_URL} target="_blank" rel="noreferrer" className={ghostBtn}>
          {t("sdkDocs")} ↗
        </a>
      </header>

      {!studio.termsUpToDate && <TermsBanner isOwner={studio.myRole === "OWNER"} onAccepted={load} />}

      {studio.termsUpToDate && <CreateGameForm />}

      <Section title={t("myGames")}>
        {games.length === 0 ? (
          <p className="py-6 text-center text-muted">{t("noGames")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => (
              <Link
                key={g.id}
                href={`/developer/games/${g.id}`}
                className="flex flex-col overflow-hidden rounded-xl border border-line bg-bg hover:border-neon/60"
              >
                <div className="aspect-video bg-surface-2">
                  {g.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.thumbnailUrl} alt="" className="size-full object-cover" />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{g.name}</span>
                    <StatusBadge status={g.status} kind="game" />
                  </div>
                  <p className="text-xs text-muted">
                    {g.versions[0] ? `v${g.versions[0].version} · ` : ""}
                    {t("statsLine", { sessions: g.stats.sessions, players: g.stats.players })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <StudioMembers myRole={studio.myRole} onLeft={load} />
    </div>
  );
}

/** Điều khoản có phiên bản mới → chủ studio phải đồng ý lại mới tạo game / upload được */
function TermsBanner({ isOwner, onAccepted }: { isOwner: boolean; onAccepted: () => void }) {
  const t = useTranslations("developer");
  const errorText = useErrorText();
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neon-pink/50 bg-neon-pink/10 px-4 py-3 text-sm">
      <p>
        {t(isOwner ? "termsOutdatedOwner" : "termsOutdatedMember")}{" "}
        <a href="/terms/developer" target="_blank" rel="noreferrer" className="font-semibold text-neon underline">
          {t("readTerms")} ↗
        </a>
      </p>
      {isOwner && (
        <button
          type="button"
          disabled={state.busy}
          onClick={async () => {
            setState({ busy: true });
            try {
              await apiFetch("/developer/studio/terms", { method: "POST" });
              onAccepted();
            } catch (err) {
              setState({ busy: false, error: errorText(errorCode(err)) });
            }
          }}
          className={primaryBtn}
        >
          {t("acceptTerms")}
        </button>
      )}
      {state.error && <p className="w-full text-neon-pink">{state.error}</p>}
    </div>
  );
}

function Onboarding({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("developer");
  const errorText = useErrorText();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold">{t("becomeTitle")}</h1>
        <p className="mt-2 text-muted">{t("becomeIntro")}</p>
      </div>

      <ol className="grid gap-2 text-sm">
        {(["step1", "step2", "step3", "step4"] as const).map((k, i) => (
          <li key={k} className="flex gap-3 rounded-xl border border-line bg-surface px-4 py-3">
            <span className="font-display font-bold text-neon">{i + 1}</span>
            <span>{t(`steps.${k}`)}</span>
          </li>
        ))}
      </ol>

      <form
        className="flex flex-col gap-4 rounded-2xl border border-neon/40 bg-surface p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setState({ busy: true });
          try {
            await apiFetch("/developer/studio", {
              method: "POST",
              json: { name: name.trim(), slug, description: description.trim() || null, acceptTerms: agreed },
            });
            onCreated();
          } catch (err) {
            setState({ busy: false, error: errorText(errorCode(err)) });
          }
        }}
      >
        <Field label={t("studioName")}>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            required
            minLength={2}
            maxLength={60}
            placeholder="Ha Pham Studio"
            className={inputCls}
          />
        </Field>
        <Field label={t("studioSlug")} hint={t("slugHint")}>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className={`${inputCls} font-mono`}
          />
        </Field>
        <Field label={t("studioDescription")}>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} className={inputCls} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required className="mt-0.5 accent-neon" />
          <span>
            {t("agreePrefix")}{" "}
            <a href="/terms/developer" target="_blank" rel="noreferrer" className="font-semibold text-neon underline">
              {t("termsLink")} ↗
            </a>
          </span>
        </label>
        {state.error && <p className="text-sm text-neon-pink">{state.error}</p>}
        <button type="submit" disabled={state.busy || !agreed} className={`${primaryBtn} self-start`}>
          {state.busy ? t("creating") : t("createStudio")}
        </button>
      </form>
    </div>
  );
}

function CreateGameForm() {
  const t = useTranslations("developer");
  const tAdmin = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [form, setForm] = useState({ slug: "", nameVi: "", nameEn: "", descVi: "", descEn: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });

  useEffect(() => {
    if (open && categories.length === 0) {
      apiFetch<{ categories: { slug: string; name: string }[] }>(`/categories?locale=${locale}`)
        .then((r) => setCategories(r.categories))
        .catch(() => undefined);
    }
  }, [open, categories.length, locale]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${primaryBtn} self-start`}>
        + {t("newGame")}
      </button>
    );
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value, ...(key === "nameVi" && !slugTouched ? { slug: slugify(value) } : {}) }));
  };

  return (
    <form
      className="grid gap-4 rounded-2xl border border-neon/40 bg-surface p-5 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setState({ busy: true });
        try {
          const { game } = await apiFetch<{ game: { id: string } }>("/developer/games", {
            method: "POST",
            json: {
              slug: form.slug,
              categorySlugs: picked,
              translations: [
                { locale: "vi", name: form.nameVi.trim(), description: form.descVi.trim() || null },
                { locale: "en", name: (form.nameEn || form.nameVi).trim(), description: form.descEn.trim() || null },
              ],
            },
          });
          router.push(`/developer/games/${game.id}`);
        } catch (err) {
          setState({ busy: false, error: errorText(errorCode(err)) });
        }
      }}
    >
      <h2 className="font-display text-xl font-semibold sm:col-span-2">{t("newGame")}</h2>
      <Field label={`${tAdmin("name")} (VI)`}>
        <input value={form.nameVi} onChange={set("nameVi")} required maxLength={100} className={inputCls} />
      </Field>
      <Field label={`${tAdmin("name")} (EN)`}>
        <input value={form.nameEn} onChange={set("nameEn")} maxLength={100} placeholder={form.nameVi} className={inputCls} />
      </Field>
      <Field label="Slug" hint={t("gameSlugHint")}>
        <input
          value={form.slug}
          onChange={(e) => {
            setSlugTouched(true);
            set("slug")(e);
          }}
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          className={`${inputCls} font-mono`}
        />
      </Field>
      <div className="hidden sm:block" />
      <Field label={`${tAdmin("description")} (VI)`}>
        <textarea value={form.descVi} onChange={set("descVi")} rows={2} maxLength={2000} className={inputCls} />
      </Field>
      <Field label={`${tAdmin("description")} (EN)`}>
        <textarea value={form.descEn} onChange={set("descEn")} rows={2} maxLength={2000} className={inputCls} />
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
      {state.error && <p className="text-sm text-neon-pink sm:col-span-2">{state.error}</p>}
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" disabled={state.busy} className={primaryBtn}>
          {state.busy ? t("creating") : t("createGame")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={ghostBtn}>
          {tAdmin("cancel")}
        </button>
      </div>
    </form>
  );
}
