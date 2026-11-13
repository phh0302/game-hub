"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";
import { ghostBtn, Section, useErrorText } from "./shared";

type LogEvent = {
  id: string;
  type: string;
  createdAt: string;
  data: Record<string, unknown> | null;
  user: { id: string; displayName: string } | null;
};

const KNOWN = [
  "platform.key.create",
  "platform.key.revoke",
  "platform.origins",
  "platform.scoring",
  "score.rejected",
  "score.deleted",
  "player.ban",
  "player.unban",
] as const;

/** Nhật ký Platform API: key, domain, chế độ nộp điểm, điểm bị từ chối / xóa, cấm người chơi */
export function PlatformLog({ gameId }: { gameId: string }) {
  const t = useTranslations("developer.log");
  const locale = useLocale();
  const errorText = useErrorText();
  const [events, setEvents] = useState<LogEvent[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "medium" });

  const load = useCallback(
    async (after?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ events: LogEvent[]; nextCursor: string | null }>(
          `/developer/games/${gameId}/events${after ? `?cursor=${encodeURIComponent(after)}` : ""}`,
        );
        setEvents((prev) => (after && prev ? [...prev, ...res.events] : res.events));
        setCursor(res.nextCursor);
      } catch (err) {
        setError(errorText(errorCode(err)));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function detail(e: LogEvent): string {
    const d = e.data ?? {};
    switch (e.type) {
      case "platform.key.create":
        return `${String(d.prefix ?? "")}… (${d.kind === "SECRET" ? "secret" : "publishable"})`;
      case "platform.origins":
        return Array.isArray(d.origins) ? (d.origins as string[]).join(", ") || "—" : "";
      case "platform.scoring":
        return d.scoreSubmission === "server" ? t("scoringServer") : t("scoringClient");
      case "score.rejected":
        return `${String(d.reason ?? "")} · ${String(d.value ?? "")} · ${String(d.durationSeconds ?? "")}s`;
      case "score.deleted":
        return `${String(d.value ?? "")}${d.reason ? ` · ${String(d.reason)}` : ""}`;
      case "player.ban":
        return d.reason ? String(d.reason) : "";
      default:
        return "";
    }
  }

  return (
    <Section
      title={t("title")}
      aside={
        <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => void load()} disabled={loading}>
          {t("refresh")}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <p className="text-sm text-neon-pink">{error}</p>}
        {events && events.length === 0 && <p className="text-sm text-muted">{t("empty")}</p>}
        {events && events.length > 0 && (
          <ul data-testid="platform-log" className="divide-y divide-line/60 rounded-lg border border-line text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2">
                <span className="font-medium">
                  {(KNOWN as readonly string[]).includes(e.type) ? t(`types.${e.type.replaceAll(".", "_")}`) : e.type}
                </span>
                <span className="min-w-0 flex-1 break-all font-mono text-xs text-muted">{detail(e)}</span>
                <span className="text-xs text-muted">
                  {e.user ? `${e.user.displayName} · ` : ""}
                  {date.format(new Date(e.createdAt))}
                </span>
              </li>
            ))}
          </ul>
        )}
        {cursor && (
          <button type="button" className={`${ghostBtn} self-start`} disabled={loading} onClick={() => void load(cursor)}>
            {t("more")}
          </button>
        )}
      </div>
    </Section>
  );
}
