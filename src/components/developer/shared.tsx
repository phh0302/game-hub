"use client";

import { useTranslations } from "next-intl";

export type GameStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "MAINTENANCE" | "SUSPENDED" | "ARCHIVED";
export type VersionStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

const TONE: Record<string, string> = {
  DRAFT: "border-line text-muted",
  PENDING_REVIEW: "border-neon/50 text-neon",
  PUBLISHED: "border-neon-lime/50 text-neon-lime",
  APPROVED: "border-neon-lime/50 text-neon-lime",
  MAINTENANCE: "border-line text-ink",
  SUSPENDED: "border-neon-pink/50 text-neon-pink",
  REJECTED: "border-neon-pink/50 text-neon-pink",
  ARCHIVED: "border-line text-muted",
};

export function StatusBadge({ status, kind }: { status: string; kind: "game" | "version" }) {
  const t = useTranslations("admin");
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE[status] ?? "border-line"}`}>
      {t(kind === "game" ? `gameStatus.${status}` : `versionStatus.${status}`)}
    </span>
  );
}

/** Tiêu đề mục + khung */
export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {aside}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-neon";
export const primaryBtn =
  "rounded-lg bg-linear-to-r from-neon to-neon-pink px-5 py-2 font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-60";
export const ghostBtn = "rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink disabled:opacity-60";

/** "Game Đua Xe" → "game-dua-xe" */
export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** Dịch mã lỗi API trong namespace developer.errors, không có thì báo chung kèm mã */
export function useErrorText() {
  const t = useTranslations("developer");
  return (code: string, detail?: string) =>
    t.has(`errors.${code}`) ? t(`errors.${code}`, { detail: detail ?? "" }) : t("errors.generic", { code });
}

/** Gợi ý phiên bản kế tiếp: 1.0.0 → 1.0.1 */
export function nextVersion(latest?: string) {
  if (!latest) return "1.0.0";
  const m = latest.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return m ? `${m[1]}.${m[2]}.${Number(m[3]) + 1}` : "";
}
