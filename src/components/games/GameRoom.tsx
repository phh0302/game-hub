"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { LeaderboardPanel } from "@/components/leaderboard/LeaderboardPanel";
import { ReportGameButton } from "@/components/reports/ReportGameButton";
import { InviteButton, ShareButton } from "./ShareButton";
import { ShareSheet, type ShareOutcome, type ShareRequest } from "./ShareSheet";
import { inviteUrl } from "@/modules/referrals/codes";
import { apiFetch, errorCode } from "@/lib/client-api";
import { displayName } from "@/lib/format";
import { formatScore, type ScoreFormat } from "@/lib/score-format";
import { handleStateMessage, readLocalState, writeLocalState } from "@/lib/game-state";

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
type InviteInfo = { code: string; invited: number; invitedViaGame: number; invitedBy: string | null };
/** Chữ do game gửi (share/invite) – cắt ngắn, bỏ ký tự điều khiển */
function cleanText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  return text || null;
}

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
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  /** Phòng chơi theo lượt đang tham gia (hub hỏi lại máy chủ định kỳ và gửi ROOM_UPDATE vào game) */
  const [room, setRoom] = useState<{ code: string; seq: number; finished: boolean } | null>(null);
  const [roomCodeFromUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const c = new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? null;
    return c && /^[A-Z2-9]{6}$/.test(c) ? c : null;
  });
  const [shareReq, setShareReq] = useState<ShareRequest | null>(null);
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
      // Chưa có nhà cung cấp quảng cáo → game ẩn nút "xem quảng cáo nhận thưởng"
      ads: { rewarded: false, interstitial: false },
      // GameHub.share() / GameHub.invite() mở bảng chia sẻ của hub
      social: { share: true, invite: true },
      // Phòng chơi theo lượt: GameHub.rooms.*; roomCode = mã phòng trong link mời (?room=)
      rooms: true,
      roomCode: roomCodeFromUrl,
      // Bạn bè đã mời (game có thể tặng thưởng); invitedBy = ai đã mời người chơi này
      invites: invite ? { count: invite.invited, viaGame: invite.invitedViaGame, invitedBy: invite.invitedBy } : null,
    });
  }, [post, locale, user, canSubmitScore, invite, roomCodeFromUrl]);

  // Mã mời + số bạn đã mời (chỉ tài khoản có ví)
  useEffect(() => {
    if (!canSubmitScore) {
      setInvite(null);
      return;
    }
    let alive = true;
    apiFetch<InviteInfo>(`/me/invite?game=${encodeURIComponent(slug)}`)
      .then((r) => alive && setInvite(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [canSubmitScore, slug]);

  const tShare = useTranslations("share");
  const openShare = useCallback(
    (kind: "share" | "invite", options: { text?: string | null; score?: number | null; requestId?: string; room?: string | null } = {}) => {
      const score = kind === "share" && options.score !== undefined && options.score !== null ? options.score : null;
      const url = inviteUrl(window.location.origin, { slug, code: invite?.code, score, room: options.room });
      const text =
        options.text ??
        (kind === "invite"
          ? options.room
            ? tShare("roomInviteText", { game: gameName, code: options.room })
            : tShare("inviteText", { game: gameName })
          : score !== null
            ? tShare(scoreFormat === "duration_ms" ? "scoreTextTime" : "scoreText", { score: fmt(score), game: gameName })
            : tShare("gameText", { game: gameName }));
      setShareReq({ kind, title: gameName, text, url, requestId: options.requestId });
    },
    [slug, invite?.code, tShare, gameName, scoreFormat, fmt],
  );

  const closeShare = useCallback(
    (outcome: ShareOutcome) => {
      if (shareReq?.requestId) post("SHARE_RESULT", { requestId: shareReq.requestId, ...outcome });
      setShareReq(null);
      iframeRef.current?.focus();
    },
    [post, shareReq],
  );

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
  /**
   * GameHub.saveState / loadState. Khách: lưu trong trình duyệt. Đã đăng nhập: lưu theo tài khoản trên máy chủ
   * (đồng bộ giữa thiết bị) + bản sao trong trình duyệt; tiến trình chơi lúc chưa đăng nhập được chuyển sang tài khoản.
   */
  const handleState = useCallback(
    async (type: "STATE_SAVE" | "STATE_LOAD", payload: Record<string, unknown>) => {
      const requestId = payload.requestId;
      const userId = user?.id;
      const scope = userId ? `${slug}:u:${userId}` : slug;
      const local = handleStateMessage(type, payload, scope);
      if (!local) return;
      if (!userId) return post("STATE_RESULT", local);

      if (type === "STATE_SAVE") {
        if (!local.saved && local.code !== "STORAGE_UNAVAILABLE") return post("STATE_RESULT", local); // quá lớn / sai kiểu
        try {
          await apiFetch(`/games/${slug}/state`, {
            method: "PUT",
            body: String(payload.data),
            headers: { "Content-Type": "text/plain;charset=utf-8" },
          });
          return post("STATE_RESULT", { requestId, saved: true, code: null });
        } catch (err) {
          // Máy chủ lỗi: vẫn còn bản trong trình duyệt nếu lưu được
          return post("STATE_RESULT", local.saved ? { requestId, saved: true, code: "SYNC_FAILED" } : { requestId, saved: false, code: errorCode(err) });
        }
      }

      try {
        const remote = await apiFetch<{ data: string | null }>(`/games/${slug}/state`);
        if (remote.data !== null) {
          writeLocalState(scope, remote.data);
          return post("STATE_RESULT", { requestId, data: remote.data });
        }
        // Chưa có trên máy chủ: lấy bản của tài khoản trên máy này, hoặc tiến trình lúc chơi khách → đẩy lên tài khoản
        const carried = (local.data as string | null) ?? readLocalState(slug);
        if (carried !== null) {
          await apiFetch(`/games/${slug}/state`, {
            method: "PUT",
            body: carried,
            headers: { "Content-Type": "text/plain;charset=utf-8" },
          }).then(
            () => {
              writeLocalState(scope, carried);
              if (local.data === null) writeLocalState(slug, null); // tiến trình khách đã thuộc tài khoản này
            },
            () => undefined,
          );
        }
        return post("STATE_RESULT", { requestId, data: carried });
      } catch {
        return post("STATE_RESULT", local); // mất mạng → dùng bản trong trình duyệt
      }
    },
    [user?.id, slug, post],
  );

  /** GameHub.rooms.* → gọi API phòng, trả ROOM_RESULT; từ đó hub tự hỏi lại phòng và gửi ROOM_UPDATE */
  const roomAction = useCallback(
    async (payload: Record<string, unknown>) => {
      const requestId = typeof payload.requestId === "string" ? payload.requestId.slice(0, 40) : undefined;
      const op = String(payload.op ?? "");
      const body = (payload.body && typeof payload.body === "object" ? payload.body : {}) as Record<string, unknown>;
      const base = `/games/${slug}/rooms`;
      try {
        let res: { room: { code: string; seq: number; status: string } };
        if (op === "create") res = await apiFetch(base, { method: "POST", json: body });
        else {
          const code = op === "join" ? String(body.code ?? "").toUpperCase() : room?.code;
          if (!code) throw Object.assign(new Error("NO_ROOM"), { code: "NO_ROOM" });
          if (!["join", "leave", "start", "move"].includes(op)) throw Object.assign(new Error("BAD_OP"), { code: "VALIDATION_ERROR" });
          res = await apiFetch(`${base}/${code}/${op}`, { method: "POST", json: op === "move" ? body : {} });
        }
        const r = res.room;
        setRoom(op === "leave" ? null : { code: r.code, seq: r.seq, finished: r.status === "FINISHED" });
        post("ROOM_RESULT", { requestId, ok: true, room: r });
      } catch (err) {
        const code = errorCode(err);
        post("ROOM_RESULT", { requestId, ok: false, code: code === "UNAUTHORIZED" || code === "GUEST_NOT_ALLOWED" ? "LOGIN_REQUIRED" : code });
      }
    },
    [slug, room?.code, post],
  );

  // Đang ở trong phòng → hỏi lại mỗi 1,5 giây (dừng khi tab ẩn / phòng kết thúc), có gì mới thì gửi ROOM_UPDATE
  useEffect(() => {
    if (!room || room.finished) return;
    let seq = room.seq;
    let stopped = false;
    const tick = async () => {
      if (stopped || document.hidden) return;
      try {
        const { room: r } = await apiFetch<{ room: { code: string; seq: number; status: string } }>(
          `/games/${slug}/rooms/${room.code}?since=${seq}`,
        );
        if (stopped || r.seq === seq) return;
        seq = r.seq;
        post("ROOM_UPDATE", { room: r });
        if (r.status === "FINISHED") setRoom({ code: r.code, seq: r.seq, finished: true });
      } catch {
        // mạng chập chờn: lần sau hỏi lại
      }
    };
    const id = window.setInterval(() => void tick(), 1500);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [room?.code, room?.finished, slug, post]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlers = useRef({ sendInit, startSession, finishSession, post, handleState, slug, openShare, roomAction });
  handlers.current = { sendInit, startSession, finishSession, post, handleState, slug, openShare, roomAction };

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
        case "STATE_SAVE":
        case "STATE_LOAD":
          void h.handleState(msg.type, payload);
          break;
        case "TRACK":
          // Sự kiện game (GameHub.track) → máy chủ đếm theo ngày cho trang Developer; lỗi thì bỏ qua (không ảnh hưởng game)
          if (Array.isArray(payload.events) && payload.events.length > 0) {
            void apiFetch(`/games/${handlers.current.slug}/events`, {
              method: "POST",
              json: { events: payload.events.slice(0, 50) },
            }).catch(() => undefined);
          }
          break;
        case "SHARE":
        case "INVITE": {
          // GameHub.share({ text?, score? }) / GameHub.invite({ text? }) → bảng chia sẻ của hub, trả SHARE_RESULT khi đóng
          const requestId = typeof payload.requestId === "string" ? payload.requestId.slice(0, 40) : undefined;
          const score = Number(payload.score);
          h.openShare(msg.type === "INVITE" ? "invite" : "share", {
            text: cleanText(payload.text),
            score: msg.type === "SHARE" && Number.isFinite(score) && score >= 0 ? Math.floor(score) : null,
            requestId,
            room: msg.type === "INVITE" && typeof payload.room === "string" ? payload.room.toUpperCase().slice(0, 6) : null,
          });
          break;
        }
        case "ROOM": {
          void h.roomAction(payload);
          break;
        }
        case "AD_REQUEST":
          // Chưa bật quảng cáo (Phase 11)
          h.post("AD_RESULT", { requestId: payload.requestId, shown: false, rewarded: false, reason: "NO_ADS" });
          break;
      }
    }
    window.addEventListener("message", onMessage);
    // Game tải xong trước khi hub sẵn sàng nghe (máy nhanh / game nhỏ) → READY bị lỡ và game tự chuyển sang
    // chế độ độc lập. Gửi INIT ngay khi bắt đầu nghe; game chưa tải thì bỏ qua, READY đến sau vẫn được trả lời.
    readyRef.current = true;
    handlers.current.sendInit();
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
          onLoad={() => {
            iframeRef.current?.focus();
            // Game tải lại (đổi trang trong khung) → gửi lại INIT
            if (readyRef.current) handlers.current.sendInit();
          }}
          className="block h-[min(78vh,720px)] min-h-[480px] w-full"
        />
        {shareReq && <ShareSheet request={shareReq} onClose={closeShare} />}
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
          <ShareButton hasScore={Boolean(lastScore)} onClick={() => openShare("share", { score: lastScore?.value ?? null })} />
          {canSubmitScore && invite && <InviteButton onClick={() => openShare("invite")} invited={invite.invited} />}
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
