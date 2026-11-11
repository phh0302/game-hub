"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { LeaderboardPanel } from "@/components/leaderboard/LeaderboardPanel";
import { ReportGameButton } from "@/components/reports/ReportGameButton";
import { ShareButton } from "./ShareButton";
import { apiFetch, errorCode } from "@/lib/client-api";
import { displayName } from "@/lib/format";
import { formatScore, type ScoreFormat } from "@/lib/score-format";

/** Giao thức Game Hub SDK v1 – xem docs/GAME_SDK.md */
const PROTOCOL = "gamehub";
const PROTOCOL_VERSION = 1;

type SubmitResult = {
  isNewBest: boolean;
  best: number;
  rank: number | null;
  score: { value: number };
  format?: ScoreFormat;
  /** Giải đấu đang diễn ra cũng nhận điểm này */
  tournaments?: { key: string; rank: number | null }[];
};
type Toast = { kind: "success" | "info" | "error"; text: string };

export function GameRoom({
  slug,
  playUrl,
  gameName,
  scoreFormat = "number",
}: {
  slug: string;
  playUrl: string | null;
  gameName: string;
  /** Kiểu hiển thị điểm của bảng xếp hạng mặc định (điểm / thời gian) */
  scoreFormat?: ScoreFormat;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const onScoreSaved = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <GamePlayer slug={slug} playUrl={playUrl} gameName={gameName} scoreFormat={scoreFormat} onScoreSaved={onScoreSaved} />
      <div className="flex flex-col gap-3">
        <LeaderboardPanel slug={slug} refreshKey={refreshKey} />
        <a href={`/games/${slug}/leaderboard`} className="text-center text-sm font-semibold text-neon hover:underline">
          <ViewAllLabel />
        </a>
      </div>
    </div>
  );
}

function ViewAllLabel() {
  const t = useTranslations("leaderboard");
  return <>{t("viewAll")} →</>;
}

function GamePlayer({
  slug,
  playUrl,
  gameName,
  scoreFormat,
  onScoreSaved,
}: {
  slug: string;
  playUrl: string | null;
  gameName: string;
  scoreFormat: ScoreFormat;
  onScoreSaved: () => void;
}) {
  const t = useTranslations("game");
  const locale = useLocale();
  const { user, login, status } = useAuth();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  /** Lượt chơi hiện tại: Promise<sessionId | null> (null = không lưu điểm được) */
  const sessionRef = useRef<Promise<string | null> | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  /** Điểm ván vừa xong – dùng cho nút "Khoe điểm" */
  const [lastScore, setLastScore] = useState<{ value: number; format: ScoreFormat } | null>(null);
  /** Bảng tính theo thời gian dùng câu "hoàn thành trong 0:42,7" thay vì "đạt X điểm" */
  const msg = useCallback((key: string, format: ScoreFormat = scoreFormat) => (format === "duration_ms" ? `${key}Time` : key), [scoreFormat]);

  const canSubmitScore = Boolean(user && !user.isGuest);
  const fmt = useCallback(
    (value: number, format: ScoreFormat = scoreFormat) => formatScore(value, format, locale),
    [scoreFormat, locale],
  );

  const errorText = useCallback(
    (code: string) => (t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.UNKNOWN")),
    [t],
  );

  const post = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    // Game chạy trong sandbox (origin "null") → không đặt được targetOrigin; dữ liệu gửi đi không nhạy cảm
    iframeRef.current?.contentWindow?.postMessage({ source: PROTOCOL, v: PROTOCOL_VERSION, type, payload }, "*");
  }, []);

  const sendInit = useCallback(() => {
    post("INIT", {
      protocolVersion: PROTOCOL_VERSION,
      standalone: false,
      locale,
      player: user ? { displayName: displayName(user) } : null,
      canSubmitScore,
    });
  }, [post, locale, user, canSubmitScore]);

  // Người chơi đăng nhập / đổi ngôn ngữ sau khi game đã tải → gửi lại INIT
  useEffect(() => {
    if (readyRef.current) sendInit();
  }, [sendInit]);

  /**
   * Báo kết quả lưu điểm ở 2 nơi: thông báo của hub + gửi SCORE_RESULT vào game
   * (người chơi đang nhìn màn "hết ván" trong game nên phải thấy kết quả ở đó).
   */
  const report = useCallback(
    (r: { saved: boolean; kind: Toast["kind"]; text: string; code?: string; data?: Record<string, unknown> }) => {
      setToast({ kind: r.kind, text: r.text });
      post("SCORE_RESULT", { saved: r.saved, code: r.code ?? null, message: r.text, ...r.data });
    },
    [post],
  );

  const startSession = useCallback(() => {
    if (!canSubmitScore) {
      sessionRef.current = null;
      // Vẫn đếm lượt chơi của khách (không lưu điểm) để thống kê
      void apiFetch(`/games/${slug}/plays`, { method: "POST" }).catch(() => undefined);
      return;
    }
    sessionRef.current = apiFetch<{ sessionId: string }>(`/games/${slug}/sessions`, { method: "POST" })
      .then((r) => r.sessionId)
      .catch((err) => {
        setToast({ kind: "error", text: errorText(errorCode(err)) });
        return null;
      });
  }, [canSubmitScore, slug, errorText]);

  const finishSession = useCallback(
    async (payload: { score?: unknown; leaderboard?: unknown }) => {
      const score = Math.floor(Number(payload.score));
      if (!Number.isFinite(score) || score < 0) return;
      const leaderboard = typeof payload.leaderboard === "string" ? payload.leaderboard : "default";
      setLastScore({ value: score, format: scoreFormat });

      const pending = sessionRef.current;
      sessionRef.current = null;

      if (!pending) {
        report(
          canSubmitScore
            ? // Kết nối ví khi ván đang chơi dở → ván này không có lượt chơi phía server
              { saved: false, kind: "info", code: "STARTED_BEFORE_LOGIN", text: t(msg("notSavedLateLogin"), { score: fmt(score) }) }
            : { saved: false, kind: "info", code: "NOT_SIGNED_IN", text: t(msg("notSaved"), { score: fmt(score) }) },
        );
        return;
      }

      const sessionId = await pending;
      if (!sessionId) {
        report({ saved: false, kind: "error", code: "SESSION_NOT_STARTED", text: errorText("SESSION_NOT_STARTED") });
        return;
      }

      try {
        const res = await apiFetch<SubmitResult>(`/games/${slug}/scores`, {
          method: "POST",
          json: { sessionId, score, leaderboard },
        });
        const rank = res.rank ?? "–";
        const main = res.isNewBest
          ? t(msg("newBest", res.format), { score: fmt(res.score.value, res.format), rank })
          : t(msg("saved", res.format), { score: fmt(res.score.value, res.format), best: fmt(res.best, res.format), rank });
        const event = res.tournaments?.find((x) => x.rank !== null);
        report({
          saved: true,
          kind: "success",
          text: event ? `${main} · ${t("tournamentRank", { rank: event.rank! })}` : main,
          data: { score: res.score.value, best: res.best, rank: res.rank, isNewBest: res.isNewBest },
        });
        onScoreSaved();
      } catch (err) {
        const code = errorCode(err);
        report({ saved: false, kind: "error", code, text: errorText(code) });
      }
    },
    [canSubmitScore, slug, t, fmt, msg, scoreFormat, onScoreSaved, errorText, report],
  );

  // Luôn dùng handler mới nhất mà không phải gỡ/gắn lại listener
  const handlers = useRef({ sendInit, startSession, finishSession, post });
  handlers.current = { sendInit, startSession, finishSession, post };

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Chỉ nhận tin nhắn từ đúng iframe game
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const msg = event.data as { source?: string; v?: number; type?: string; payload?: Record<string, unknown> };
      if (!msg || msg.source !== PROTOCOL || msg.v !== PROTOCOL_VERSION || typeof msg.type !== "string") return;
      const payload = msg.payload ?? {};
      const h = handlers.current;

      switch (msg.type) {
        case "READY":
          readyRef.current = true;
          h.sendInit();
          break;
        case "GAME_START":
          h.startSession();
          break;
        case "GAME_OVER":
          void h.finishSession(payload);
          break;
        case "AD_REQUEST":
          // Chưa bật quảng cáo (Phase 11)
          h.post("AD_RESULT", { requestId: payload.requestId, shown: false, rewarded: false, reason: "NO_ADS" });
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Thông báo thành công tự ẩn; lỗi / không lưu được thì giữ đến khi người chơi đóng
  useEffect(() => {
    if (toast?.kind !== "success") return;
    const id = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(id);
  }, [toast]);

  if (!playUrl) {
    return (
      <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-muted">
        {t("unavailable")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!canSubmitScore && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neon/30 bg-neon/5 px-4 py-3 text-sm">
          <span className="text-muted">{t("loginToSave")}</span>
          <button
            type="button"
            onClick={() => void login()}
            disabled={status !== "idle"}
            className="rounded-lg border border-neon/60 px-3 py-1.5 font-semibold text-neon hover:bg-neon/10 disabled:opacity-60"
          >
            {t("connect")}
          </button>
        </div>
      )}

      <div ref={wrapRef} className="relative overflow-hidden rounded-2xl border border-line bg-bg">
        <iframe
          ref={iframeRef}
          src={playUrl}
          title={gameName}
          // Không có allow-same-origin: game không đọc được cookie / trang của hub
          sandbox="allow-scripts allow-pointer-lock"
          allow="autoplay; gamepad; fullscreen"
          referrerPolicy="no-referrer"
          loading="eager"
          onLoad={() => iframeRef.current?.focus()}
          className="block h-[min(78vh,720px)] min-h-[480px] w-full"
        />
        {toast && (
          <div
            role={toast.kind === "error" ? "alert" : "status"}
            className={`absolute inset-x-3 bottom-3 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${
              toast.kind === "success"
                ? "border-neon-lime/50 bg-bg/90 text-neon-lime"
                : toast.kind === "error"
                  ? "border-neon-pink/50 bg-bg/90 text-neon-pink"
                  : "border-line bg-bg/90 text-ink"
            }`}
          >
            <span className="flex-1">{toast.text}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label={t("dismiss")}
              className="-my-1 -mr-1 rounded-md px-2 py-1 text-base leading-none opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-start gap-2">
          <ShareButton slug={slug} gameName={gameName} score={lastScore} />
          <ReportGameButton slug={slug} />
        </div>
        <button
          type="button"
          onClick={() => void wrapRef.current?.requestFullscreen?.()}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
        >
          {t("fullscreen")}
        </button>
      </div>
    </div>
  );
}
