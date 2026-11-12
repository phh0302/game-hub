"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch } from "@/lib/client-api";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatScore, type ScoreFormat } from "@/lib/score-format";

type Period = "day" | "week" | "all";

type Entry = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
};

type BoardResponse = {
  leaderboard: { key: string; name: string | null; order: "ASC" | "DESC"; format?: ScoreFormat };
  entries: Entry[];
  me: { rank: number; score: number } | null;
};

type BoardInfo = {
  key: string;
  name: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: "UPCOMING" | "OPEN" | "ENDED";
};

const PERIODS: Period[] = ["day", "week", "all"];

/** "còn 3 ngày" / "bắt đầu sau 5 giờ" – đơn vị lớn nhất có nghĩa */
function relative(target: string, locale: string) {
  const diff = new Date(target).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale === "vi" ? "vi" : "en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs >= 86_400_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  if (abs >= 3_600_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.max(1, Math.round(abs / 60_000)) * Math.sign(diff || 1), "minute");
}

export function LeaderboardPanel({
  slug,
  board = "default",
  limit = 10,
  refreshKey = 0,
  compact = false,
}: {
  slug: string;
  board?: string;
  limit?: number;
  /** Đổi giá trị này để tải lại (vd: sau khi nộp điểm) */
  refreshKey?: number;
  compact?: boolean;
}) {
  const t = useTranslations("leaderboard");
  const locale = useLocale();
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("all");
  const [boardKey, setBoardKey] = useState(board);
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [data, setData] = useState<BoardResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  // Danh sách bảng (bảng chính + giải đấu) – chỉ hiện bộ chọn khi có từ 2 bảng
  useEffect(() => {
    apiFetch<{ leaderboards: BoardInfo[] }>(`/games/${slug}/leaderboards`)
      .then((r) => setBoards(r.leaderboards))
      .catch(() => setBoards([]));
    // Tải lại khi đổi ngôn ngữ để tên giải đấu theo ngôn ngữ mới
  }, [slug, refreshKey, locale]);

  const current = boards.find((b) => b.key === boardKey);
  // Giải đấu có thời hạn → xếp hạng cả giải, không chia hôm nay / tuần
  const isEvent = boardKey !== "default" && Boolean(current?.startsAt || current?.endsAt);
  const effectivePeriod: Period = isEvent ? "all" : period;

  const load = useCallback(async () => {
    setState("loading");
    try {
      const qs = new URLSearchParams({ board: boardKey, period: effectivePeriod, limit: String(limit) });
      setData(await apiFetch<BoardResponse>(`/games/${slug}/leaderboard?${qs}`));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [slug, boardKey, effectivePeriod, limit, locale]);

  useEffect(() => {
    void load();
  }, [load, refreshKey, user?.id]);

  const fmt = (value: number) => formatScore(value, data?.leaderboard.format, locale);
  const meInList = data?.entries.some((e) => e.userId === user?.id);

  return (
    <section className="rounded-2xl border border-line bg-surface" aria-label={t("title")}>
      {boards.length > 1 && (
        <div role="tablist" aria-label={t("boards")} className="flex gap-1.5 overflow-x-auto border-b border-line px-3 py-2">
          {boards.map((b) => (
            <button
              key={b.key}
              type="button"
              role="tab"
              aria-selected={b.key === boardKey}
              onClick={() => setBoardKey(b.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                b.key === boardKey ? "border-neon/60 bg-neon/10 text-neon" : "border-line text-muted hover:text-ink"
              }`}
            >
              {b.key !== "default" && b.status === "OPEN" && <span className="size-1.5 rounded-full bg-neon-lime" aria-hidden />}
              {b.name ?? (b.key === "default" ? t("main") : b.key)}
            </button>
          ))}
        </div>
      )}

      {isEvent && current && (
        <p className="border-b border-line px-4 py-2 text-xs text-muted">
          {current.status === "UPCOMING" && current.startsAt && t("eventStarts", { when: relative(current.startsAt, locale) })}
          {current.status === "OPEN" &&
            (current.endsAt ? t("eventEnds", { when: relative(current.endsAt, locale) }) : t("eventOpen"))}
          {current.status === "ENDED" && t("eventEnded")}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-display text-lg font-semibold">{data?.leaderboard.name ?? t("title")}</h2>
        <div role="tablist" hidden={isEvent} className="flex rounded-lg border border-line p-0.5 text-xs font-semibold">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === period}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 transition ${p === period ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
            >
              {t(`periods.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {state === "error" && <p className="px-4 py-6 text-center text-sm text-neon-pink">{t("error")}</p>}

      {state !== "error" && (
        <ol className={`divide-y divide-line/60 ${state === "loading" ? "opacity-50" : ""}`}>
          {data?.entries.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">{t("empty")}</li>}
          {data?.entries.map((e) => (
            <Row key={e.userId} entry={e} highlight={e.userId === user?.id} fmt={fmt} you={t("you")} />
          ))}
          {!data && state === "loading" && (
            <li className="px-4 py-8 text-center text-sm text-muted">{t("loading")}</li>
          )}
        </ol>
      )}

      {data?.me && !meInList && (
        <div className="border-t border-line">
          <Row
            entry={{
              rank: data.me.rank,
              userId: user?.id ?? "me",
              displayName: t("you"),
              avatarUrl: user?.avatarUrl ?? null,
              score: data.me.score,
            }}
            highlight
            fmt={fmt}
            you={t("you")}
          />
        </div>
      )}

      {!compact && !user && <p className="border-t border-line px-4 py-3 text-xs text-muted">{t("loginHint")}</p>}
    </section>
  );
}

function Row({
  entry,
  highlight,
  fmt,
  you,
}: {
  entry: Entry;
  highlight: boolean;
  fmt: (value: number) => string;
  you: string;
}) {
  const medal = entry.rank === 1 ? "text-neon-lime" : entry.rank === 2 ? "text-neon" : entry.rank === 3 ? "text-neon-pink" : "text-muted";
  return (
    <li className={`flex items-center gap-3 px-4 py-2.5 text-sm ${highlight ? "bg-neon/10" : ""}`}>
      <span className={`w-8 shrink-0 text-right font-display font-bold tabular-nums ${medal}`}>#{entry.rank}</span>
      {entry.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.avatarUrl} alt="" className="size-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-muted">
          {entry.displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">
        {entry.displayName}
        {highlight && entry.displayName !== you && <span className="ml-1.5 text-xs text-neon">({you})</span>}
      </span>
      <span className="font-semibold tabular-nums">{fmt(entry.score)}</span>
    </li>
  );
}
