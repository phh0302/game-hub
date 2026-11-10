"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useAuth, type AuthUser } from "@/components/auth/AuthProvider";
import { apiFetch, errorCode } from "@/lib/client-api";
import { uploadFile } from "@/lib/upload-client";
import { displayName, shortAddress } from "@/lib/format";
import { formatScore, type ScoreFormat } from "@/lib/score-format";

type GameRef = { slug: string; name: string; thumbnailUrl: string | null };
type MyScores = {
  bests: { game: GameRef; leaderboard: string; bestScore: number; plays: number; format?: ScoreFormat }[];
  recent: { id: string; value: number; durationSeconds: number; createdAt: string; leaderboard: string; format?: ScoreFormat; game: GameRef }[];
};

export function ProfileView() {
  const t = useTranslations("profile");
  const { user } = useAuth();

  if (!user) {
    return <p className="rounded-xl border border-line bg-surface p-6 text-center text-muted">{t("loginRequired")}</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <ProfileForm user={user} />
      <Achievements />
      <Security />
    </div>
  );
}

/** Đăng xuất mọi thiết bị: dùng khi nghi lộ phiên đăng nhập hoặc đăng nhập trên máy lạ */
function Security() {
  const t = useTranslations("profile");
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-1 font-display text-xl font-semibold">{t("security")}</h2>
      <p className="mb-3 text-sm text-muted">{t("logoutAllHint")}</p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm(t("logoutAllConfirm"))) return;
          setBusy(true);
          await logout({ allDevices: true });
        }}
        className="rounded-lg border border-neon-pink/50 px-4 py-2 text-sm font-semibold text-neon-pink hover:bg-neon-pink/10 disabled:opacity-60"
      >
        {t("logoutAll")}
      </button>
    </section>
  );
}

/** Cắt ảnh thành hình vuông ở giữa + thu nhỏ còn 256x256 → file nhỏ (vài chục KB), tải nhanh */
async function squareAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  // Safari cũ không xuất được WEBP → dùng PNG
  const webp = await toBlob("image/webp");
  const blob = webp && webp.type === "image/webp" ? webp : await toBlob("image/png");
  if (!blob) throw new Error("encode");
  return blob;
}

function ProfileForm({ user }: { user: AuthUser }) {
  const t = useTranslations("profile");
  const { setUser } = useAuth();
  const [username, setUsername] = useState(user.username ?? "");
  /** undefined = giữ ảnh hiện tại · null = bỏ ảnh · string = key ảnh mới vừa upload */
  const [avatarKey, setAvatarKey] = useState<string | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(user.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; code?: string }>({ kind: "idle" });

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setState({ kind: "idle" });
    try {
      const blob = await squareAvatar(file);
      const key = await uploadFile(blob, "avatar");
      setAvatarKey(key);
      setPreview(URL.createObjectURL(blob));
    } catch (err) {
      setState({ kind: "error", code: err instanceof Error && !("code" in err) ? "IMAGE_INVALID" : errorCode(err) });
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "saving" });
    try {
      const { user: updated } = await apiFetch<{ user: AuthUser }>("/me", {
        method: "PATCH",
        json: { username: username.trim() || null, ...(avatarKey !== undefined ? { avatarKey } : {}) },
      });
      setUser(updated);
      setAvatarKey(undefined);
      setPreview(updated.avatarUrl);
      setState({ kind: "saved" });
    } catch (err) {
      setState({ kind: "error", code: errorCode(err) });
    }
  }

  const errorText = (code?: string) =>
    code === "CONFLICT"
      ? t("errors.usernameTaken")
      : code === "VALIDATION_ERROR"
        ? t("errors.invalid")
        : code && t.has(`errors.${code}`)
          ? t(`errors.${code}`)
          : t("errors.unknown");

  return (
    <form onSubmit={onSubmit} className="grid gap-6 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-2">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-24 rounded-full border border-line object-cover" />
        ) : (
          <span className="grid size-24 place-items-center rounded-full bg-surface-2 font-display text-3xl font-bold text-muted">
            {displayName(user).slice(0, 1).toUpperCase()}
          </span>
        )}
        <label className={`cursor-pointer text-xs font-semibold text-neon hover:underline ${uploading ? "pointer-events-none opacity-60" : ""}`}>
          {uploading ? t("avatarUploading") : preview ? t("avatarChange") : t("avatarUpload")}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPickAvatar} className="sr-only" />
        </label>
        {preview && !uploading && (
          <button
            type="button"
            onClick={() => {
              setAvatarKey(null);
              setPreview(null);
            }}
            className="text-xs text-muted hover:text-neon-pink"
          >
            {t("avatarRemove")}
          </button>
        )}
        {user.role === "ADMIN" && (
          <span className="rounded-md bg-neon-pink/15 px-2 py-0.5 text-xs font-semibold text-neon-pink">ADMIN</span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {user.walletAddress && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">{t("wallet")}</p>
            <p className="mt-1 font-mono text-sm" title={user.walletAddress}>
              {shortAddress(user.walletAddress)}
            </p>
          </div>
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("username")}</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            placeholder="ha_pham"
            className="rounded-lg border border-line bg-bg px-3 py-2 outline-none focus:border-neon"
          />
          <span className="text-xs text-muted">{t("usernameHint")}</span>
        </label>

        <p className="text-xs text-muted">{t("avatarHint")}</p>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={state.kind === "saving" || uploading}
            className="rounded-lg bg-linear-to-r from-neon to-neon-pink px-5 py-2 font-semibold text-bg disabled:opacity-60"
          >
            {state.kind === "saving" ? t("saving") : t("save")}
          </button>
          {state.kind === "saved" && <span className="text-sm text-neon-lime">{t("saved")}</span>}
          {state.kind === "error" && <span className="text-sm text-neon-pink">{errorText(state.code)}</span>}
        </div>
      </div>
    </form>
  );
}

function Achievements() {
  const t = useTranslations("profile");
  const locale = useLocale();
  const [data, setData] = useState<MyScores | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiFetch<MyScores>("/me/scores")
      .then(setData)
      .catch(() => setFailed(true));
  }, [locale]);

  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short" });

  if (failed) return <p className="text-neon-pink">{t("errors.unknown")}</p>;
  if (!data) return <p className="text-muted">{t("loading")}</p>;

  return (
    <>
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">{t("bests")}</h2>
        {data.bests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">
            {t("noScores")}{" "}
            <Link href="/#games" className="text-neon hover:underline">
              {t("playNow")}
            </Link>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.bests.map((b) => (
              <Link
                key={`${b.game.slug}-${b.leaderboard}`}
                href={`/games/${b.game.slug}`}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-neon/60"
              >
                {b.game.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.game.thumbnailUrl} alt="" className="h-12 w-20 rounded-md object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {b.game.name}
                    {b.leaderboard !== "default" && <span className="ml-1 text-xs text-muted">({b.leaderboard})</span>}
                  </p>
                  <p className="text-xs text-muted">{t("plays", { count: b.plays })}</p>
                </div>
                <span className="font-display text-lg font-bold tabular-nums text-neon">{formatScore(b.bestScore, b.format, locale)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {data.recent.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">{t("recent")}</h2>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-2.5">{t("game")}</th>
                  <th className="px-4 py-2.5 text-right">{t("score")}</th>
                  <th className="px-4 py-2.5 text-right">{t("duration")}</th>
                  <th className="px-4 py-2.5 text-right">{t("time")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {data.recent.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5">{s.game.name}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatScore(s.value, s.format, locale)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted">{formatDuration(s.durationSeconds)}</td>
                    <td className="px-4 py-2.5 text-right text-muted">{date.format(new Date(s.createdAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
