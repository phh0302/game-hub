"use client";

import { useTranslations } from "next-intl";

export type ScanFinding = { rule: string; severity: "critical" | "warning" | "info"; path: string; match: string; count: number };

const TONE: Record<string, string> = {
  critical: "bg-neon-pink/20 text-neon-pink border-neon-pink/50",
  warning: "bg-amber-400/15 text-amber-300 border-amber-400/40",
  info: "bg-surface-2 text-muted border-line",
  clean: "bg-neon-lime/10 text-neon-lime border-neon-lime/30",
};

/** Kết quả quét bản build: nhãn mức + danh sách phát hiện (mở sẵn khi critical) */
export function ScanBadge({ level, findings }: { level: string | null; findings: ScanFinding[] }) {
  const t = useTranslations("scan");
  if (!level) return null;
  const badge = (
    <span data-testid="scan-level" data-level={level} className={`rounded border px-1.5 py-0.5 text-xs font-semibold ${TONE[level] ?? TONE.info}`}>
      {t(`level.${level}`)}
    </span>
  );
  if (findings.length === 0) return badge;
  return (
    <details open={level === "critical"} className="mt-1 text-xs">
      <summary className="cursor-pointer list-none">
        {badge} <span className="text-muted">{t("count", { count: findings.length })}</span>
      </summary>
      <ul className="mt-1 space-y-1">
        {findings.slice(0, 12).map((f, i) => (
          <li key={i} className="rounded border border-line/60 bg-bg/60 px-2 py-1">
            <span className={`font-semibold ${f.severity === "critical" ? "text-neon-pink" : f.severity === "warning" ? "text-amber-300" : "text-muted"}`}>
              {t.has(`rules.${f.rule}`) ? t(`rules.${f.rule}`) : f.rule}
            </span>{" "}
            <span className="font-mono text-muted">
              {f.path}
              {f.count > 1 ? ` ×${f.count}` : ""}
            </span>
            <div className="mt-0.5 break-all font-mono text-[11px] text-muted">{f.match}</div>
          </li>
        ))}
      </ul>
    </details>
  );
}
