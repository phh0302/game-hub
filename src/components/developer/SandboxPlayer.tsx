"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { handleStateMessage } from "@/lib/game-state";
import { normalizeEvents } from "@/lib/game-events";
import { ShareSheet, type ShareOutcome, type ShareRequest } from "@/components/games/ShareSheet";
import { MockRoomError, MockRooms, type MockRoomView } from "@/modules/rooms/mock";
import { SandboxRooms, type BotAction } from "./SandboxRooms";

const PROTOCOL = "gamehub";
const PROTOCOL_VERSION = 1;

type LogLine = { at: string; dir: "in" | "out" | "warn"; type: string; payload: string };
type Settings = {
  loggedIn: boolean;
  canSubmitScore: boolean;
  rewarded: boolean;
  interstitial: boolean;
  share: boolean;
  rooms: boolean;
  locale: "vi" | "en";
  invites: number;
};

const CHECKS = ["READY", "GAME_START", "GAME_OVER", "STATE_SAVE", "STATE_LOAD", "TRACK", "SHARE", "AD_REQUEST", "ROOM"] as const;

const ME = { id: "me", name: "sandbox_player" };
const botName = (n: number, locale: string) => (locale === "en" ? `Virtual player ${n}` : `Người chơi ảo ${n}`);

/** Địa chỉ game được phép thử: http(s), không chứa thông tin đăng nhập */
export function sandboxUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Sandbox cho developer: chạy game từ bất kỳ địa chỉ nào (thường là http://localhost:5173 lúc đang code)
 * trong khung giống hệt hub (iframe sandbox, origin null) với hub giả lập đủ giao thức SDK:
 * INIT tùy chỉnh, điểm, lưu tiến trình, track, chia sẻ, quảng cáo, tạm dừng, phòng chơi theo lượt (MockRooms –
 * dev đóng vai người chơi ảo). Không ghi gì lên máy chủ.
 */
export function SandboxPlayer({ initialUrl }: { initialUrl: string }) {
  const t = useTranslations("sandbox");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [input, setInput] = useState(initialUrl);
  const [url, setUrl] = useState<string | null>(sandboxUrl(initialUrl) ? initialUrl : null);
  const [reloadKey, setReloadKey] = useState(0);
  const [settings, setSettings] = useState<Settings>({
    loggedIn: true,
    canSubmitScore: true,
    rewarded: true,
    interstitial: true,
    share: true,
    rooms: true,
    locale: "vi",
    invites: 0,
  });
  const [log, setLog] = useState<LogLine[]>([]);
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const [ad, setAd] = useState<{ requestId: unknown; kind: string; left: number } | null>(null);
  const [shareReq, setShareReq] = useState<ShareRequest | null>(null);
  const session = useRef<{ started: number | null; best: number | null }>({ started: null, best: null });
  const ready = useRef(false);
  /** Chỉ tải game sau khi đã nghe tin nhắn – game nhỏ tải nhanh sẽ gửi READY trước khi trang kịp nghe */
  const [listening, setListening] = useState(false);
  /** Phòng giả lập trong trình duyệt + seq gần nhất game đã biết (để ROOM_UPDATE kèm đúng các nước đi mới) */
  const rooms = useRef(new MockRooms());
  const gameSeq = useRef<number | null>(null);
  const [roomView, setRoomView] = useState<MockRoomView | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const add = useCallback((dir: LogLine["dir"], type: string, payload?: unknown) => {
    setLog((l) =>
      [{ at: new Date().toLocaleTimeString(), dir, type, payload: payload === undefined ? "" : JSON.stringify(payload).slice(0, 400) }, ...l].slice(0, 200),
    );
  }, []);

  const post = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage({ source: PROTOCOL, v: PROTOCOL_VERSION, type, payload }, "*");
      add("out", type, payload);
    },
    [add],
  );

  const initPayload = useCallback(
    (s: Settings, code: string | null = null) => ({
      protocolVersion: PROTOCOL_VERSION,
      standalone: false,
      locale: s.locale,
      player: s.loggedIn ? { displayName: "sandbox_player" } : null,
      canSubmitScore: s.loggedIn && s.canSubmitScore,
      ads: { rewarded: s.rewarded, interstitial: s.interstitial },
      social: { share: s.share, invite: s.share },
      invites: s.loggedIn ? { count: s.invites, viaGame: s.invites, invitedBy: null } : null,
      rooms: s.rooms,
      roomCode: s.rooms ? code : null,
    }),
    [],
  );

  /** Game có trong phòng (đang hoặc đã từng ngồi) → nhận ROOM_UPDATE như hub thật hỏi lại máy chủ */
  const gameInRoom = (v: MockRoomView | null) => Boolean(v && rooms.current.room?.players.some((p) => p.id === ME.id));

  /** Phòng đổi (người ảo đi, hết giờ lượt…) → cập nhật bảng + báo game */
  const pushRoom = useCallback(() => {
    const m = rooms.current;
    if (!m.room) {
      setRoomView(null);
      return;
    }
    const v = m.view(ME.id, gameSeq.current ?? undefined);
    setRoomView(v);
    if (gameInRoom(v) && gameSeq.current !== v.seq) {
      gameSeq.current = v.seq;
      post("ROOM_UPDATE", { room: v });
    }
  }, [post]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useRef({ settings, url, post, add, initPayload, t, inviteCode, pushRoom });
  ctx.current = { settings, url, post, add, initPayload, t, inviteCode, pushRoom };

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const msg = event.data as { source?: string; v?: number; type?: string; payload?: Record<string, unknown> };
      if (!msg || msg.source !== PROTOCOL) return;
      const { settings: s, post: send, add: log, initPayload: init, t: tr } = ctx.current;
      if (msg.v !== PROTOCOL_VERSION || typeof msg.type !== "string") {
        log("warn", tr("warn.protocol"), msg);
        return;
      }
      const p = msg.payload ?? {};
      log("in", msg.type, msg.type === "STATE_SAVE" ? { ...p, data: `${String(p.data ?? "").length} ký tự` } : p);
      setSeen((x) => ({ ...x, [msg.type!]: true }));

      switch (msg.type) {
        case "READY":
          ready.current = true;
          send("INIT", init(s, ctx.current.inviteCode));
          break;
        case "GAME_START":
          if (session.current.started !== null) log("warn", tr("warn.doubleStart"));
          session.current.started = Date.now();
          break;
        case "GAME_OVER": {
          const score = Number(p.score);
          if (session.current.started === null) log("warn", tr("warn.overWithoutStart"));
          if (!Number.isInteger(score) || score < 0) {
            log("warn", tr("warn.badScore"), p.score);
            send("SCORE_RESULT", { saved: false, code: "VALIDATION_ERROR", message: tr("warn.badScore") });
          } else if (!s.loggedIn || !s.canSubmitScore) {
            send("SCORE_RESULT", { saved: false, code: "LOGIN_REQUIRED", message: tr("scoreGuest", { score }) });
          } else {
            const isBest = session.current.best === null || score > session.current.best;
            if (isBest) session.current.best = score;
            const seconds = session.current.started ? Math.round((Date.now() - session.current.started) / 1000) : 0;
            send("SCORE_RESULT", {
              saved: true,
              code: null,
              message: tr("scoreSaved", { score, seconds }),
              score,
              best: session.current.best,
              isPersonalBest: isBest,
              rank: 1,
            });
          }
          session.current.started = null;
          break;
        }
        case "STATE_SAVE":
        case "STATE_LOAD": {
          const result = handleStateMessage(msg.type, p, `sandbox:${ctx.current.url ?? ""}`);
          if (result) {
            if (result.saved === false) log("warn", tr("warn.state"), result.code);
            send("STATE_RESULT", result);
          }
          break;
        }
        case "TRACK": {
          const raw = Array.isArray(p.events) ? p.events : [];
          const kept = normalizeEvents(raw);
          if (kept.length < raw.length) log("warn", tr("warn.trackDropped", { dropped: raw.length - kept.length }));
          break;
        }
        case "SHARE":
        case "INVITE": {
          const score = Number(p.score);
          const text =
            typeof p.text === "string" && p.text.trim()
              ? p.text.trim().slice(0, 200)
              : msg.type === "INVITE"
                ? tr("inviteText")
                : Number.isFinite(score)
                  ? tr("shareScoreText", { score })
                  : tr("shareText");
          setShareReq({
            kind: msg.type === "INVITE" ? "invite" : "share",
            title: "Sandbox",
            text,
            url: `https://play.monlabs.fun/games/your-game${Number.isFinite(score) ? `?score=${score}` : ""}`,
            requestId: typeof p.requestId === "string" ? p.requestId : undefined,
          });
          break;
        }
        case "ROOM": {
          // Như hub thật: create / join / leave / start / move → ROOM_RESULT; lỗi giữ nguyên mã của máy chủ
          const requestId = typeof p.requestId === "string" ? p.requestId.slice(0, 40) : undefined;
          const op = String(p.op ?? "");
          const body = (p.body && typeof p.body === "object" ? p.body : {}) as Record<string, unknown>;
          const m = rooms.current;
          try {
            if (!s.loggedIn) throw new MockRoomError("LOGIN_REQUIRED");
            let room: MockRoomView;
            if (op === "create") room = m.create(ME, body);
            else if (op === "join") room = m.join(ME, body.code);
            else if (op === "leave") room = m.leave(ME.id);
            else if (op === "start") room = m.start(ME.id);
            else if (op === "move") room = m.move(ME.id, body);
            else throw new MockRoomError("VALIDATION_ERROR");
            gameSeq.current = room.seq;
            ctx.current.pushRoom();
            send("ROOM_RESULT", { requestId, ok: true, room });
          } catch (err) {
            const code = err instanceof MockRoomError ? err.code : "ROOM_ERROR";
            if (code === "ROOM_CHANGED") log("warn", tr("warn.roomChanged"));
            send("ROOM_RESULT", { requestId, ok: false, code });
          }
          break;
        }
        case "AD_REQUEST": {
          const kind = p.kind === "interstitial" ? "interstitial" : "rewarded";
          if (!(kind === "rewarded" ? s.rewarded : s.interstitial)) {
            send("AD_RESULT", { requestId: p.requestId, shown: false, rewarded: false, reason: "NO_ADS" });
          } else {
            setAd({ requestId: p.requestId, kind, left: 3 });
          }
          break;
        }
      }
    }
    window.addEventListener("message", onMessage);
    setListening(true);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Quảng cáo giả lập: đếm ngược 3 giây rồi trả kết quả
  useEffect(() => {
    if (!ad) return;
    if (ad.left <= 0) {
      post("AD_RESULT", { requestId: ad.requestId, shown: true, rewarded: ad.kind === "rewarded" });
      setAd(null);
      return;
    }
    const id = setTimeout(() => setAd((a) => (a ? { ...a, left: a.left - 1 } : a)), 1000);
    return () => clearTimeout(id);
  }, [ad, post]);

  // Đổi thiết lập → gửi lại INIT như hub thật khi người chơi đăng nhập / đổi ngôn ngữ
  useEffect(() => {
    if (ready.current) post("INIT", initPayload(settings, inviteCode));
  }, [settings, inviteCode, post, initPayload]);

  // Hết giờ lượt / phòng hết hạn (máy chủ thật xử lý khi hub hỏi lại mỗi 1,5 giây)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (rooms.current.tick()) pushRoom();
    }, 1000);
    return () => window.clearInterval(id);
  }, [pushRoom]);

  /** Dev đóng vai người chơi ảo; trả về thông báo lỗi (hoặc null) cho bảng điều khiển */
  const botAction = (a: BotAction): string | null => {
    const m = rooms.current;
    const nextBot = () => {
      const used = new Set((m.room?.players ?? []).map((p) => p.id));
      for (let n = 1; n <= 8; n++) if (!used.has(`bot${n}`)) return { id: `bot${n}`, name: botName(n, settings.locale) };
      return { id: "bot9", name: botName(9, settings.locale) };
    };
    try {
      if (a.kind === "host") {
        m.create({ id: "bot1", name: botName(1, settings.locale) }, { maxPlayers: 2 });
        gameSeq.current = null;
      } else if (a.kind === "join") m.join(nextBot(), m.room?.code);
      else if (a.kind === "start") m.start(m.room?.players.find((p) => p.id === m.room?.hostId)?.id ?? "");
      else if (a.kind === "leave") m.leave(a.id);
      else if (a.kind === "move") {
        const id = m.turnPlayerId();
        if (!id || id === ME.id) return t("rooms.notBotTurn");
        m.move(id, { data: a.data, state: a.state, next: a.next, finish: a.finish });
      } else if (a.kind === "openInvite") {
        // Như bạn bè bấm link mời ?room=MÃ: tải lại game, init.roomCode = mã phòng
        setInviteCode(m.room?.code ?? null);
        ready.current = false;
        session.current = { started: null, best: null };
        setReloadKey((k) => k + 1);
        add("warn", t("rooms.reloadedInvite", { code: m.room?.code ?? "" }));
        return null;
      } else if (a.kind === "reset") {
        m.room = null;
        gameSeq.current = null;
        setInviteCode(null);
      }
      pushRoom();
      return null;
    } catch (err) {
      return err instanceof MockRoomError ? err.code : String(err);
    }
  };

  const closeShare = (outcome: ShareOutcome) => {
    if (shareReq?.requestId) post("SHARE_RESULT", { requestId: shareReq.requestId, ...outcome });
    setShareReq(null);
  };

  const open = () => {
    const ok = sandboxUrl(input);
    if (!ok) {
      add("warn", t("warn.url"));
      return;
    }
    ready.current = false;
    session.current = { started: null, best: null };
    setSeen({});
    setLog([]);
    setUrl(ok);
    setReloadKey((k) => k + 1);
    const q = new URL(window.location.href);
    q.searchParams.set("url", ok);
    window.history.replaceState(null, "", q);
  };

  const toggle = (key: keyof Settings) => setSettings((s) => ({ ...s, [key]: !s[key] }));
  const Toggle = ({ k }: { k: "loggedIn" | "canSubmitScore" | "rewarded" | "interstitial" | "share" | "rooms" }) => (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={settings[k]} onChange={() => toggle(k)} />
      {t(`settings.${k}`)}
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-neon/40 bg-neon/5 px-4 py-3 text-sm">
        <strong className="text-neon">{t("title")}</strong> · {t("banner")}
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          open();
        }}
      >
        <input
          data-testid="sandbox-url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="http://localhost:5173"
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-neon"
        />
        <button type="submit" className="rounded-lg bg-linear-to-r from-neon to-neon-pink px-4 py-2 font-semibold text-bg">
          {t("open")}
        </button>
        {url && (
          <>
            <button type="button" onClick={open} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink">
              {t("reload")}
            </button>
            <button type="button" onClick={() => post("PAUSE", {})} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink">
              {t("pause")}
            </button>
            <button type="button" onClick={() => post("RESUME", {})} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink">
              {t("resume")}
            </button>
          </>
        )}
      </form>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-bg">
          {url && listening ? (
            <iframe
              key={reloadKey}
              ref={iframeRef}
              src={url}
              title="Sandbox"
              sandbox="allow-scripts allow-pointer-lock"
              allow="autoplay; gamepad; fullscreen"
              referrerPolicy="no-referrer"
              onLoad={() => iframeRef.current?.focus()}
              className="block h-[min(78vh,720px)] min-h-[480px] w-full"
            />
          ) : (
            <div className="grid h-[480px] place-items-center p-6 text-center text-sm text-muted">{t("empty")}</div>
          )}
          {ad && (
            <div data-testid="sandbox-ad" className="absolute inset-0 z-20 grid place-items-center bg-bg/90 text-center">
              <div>
                <p className="font-display text-2xl font-bold">{t("adTitle", { kind: ad.kind })}</p>
                <p className="mt-2 text-muted">{t("adLeft", { left: ad.left })}</p>
                <button
                  type="button"
                  onClick={() => {
                    post("AD_RESULT", { requestId: ad.requestId, shown: true, rewarded: false, reason: "SKIPPED" });
                    setAd(null);
                  }}
                  className="mt-4 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
                >
                  {t("adSkip")}
                </button>
              </div>
            </div>
          )}
          {shareReq && <ShareSheet request={shareReq} onClose={closeShare} />}
        </div>

        <aside className="flex flex-col gap-3">
          <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
            <h2 className="mb-2 font-semibold">{t("settingsTitle")}</h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <Toggle k="loggedIn" />
              <Toggle k="canSubmitScore" />
              <Toggle k="rewarded" />
              <Toggle k="interstitial" />
              <Toggle k="share" />
              <Toggle k="rooms" />
              <label className="flex items-center gap-2">
                {t("settings.locale")}
                <select
                  value={settings.locale}
                  onChange={(e) => setSettings((s) => ({ ...s, locale: e.target.value as "vi" | "en" }))}
                  className="rounded border border-line bg-bg px-1 py-0.5"
                >
                  <option value="vi">vi</option>
                  <option value="en">en</option>
                </select>
              </label>
              <label className="col-span-2 flex items-center gap-2">
                {t("settings.invites")}
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={settings.invites}
                  onChange={(e) => setSettings((s) => ({ ...s, invites: Math.max(0, Math.min(999, Number(e.target.value) || 0)) }))}
                  className="w-20 rounded border border-line bg-bg px-1 py-0.5"
                />
              </label>
            </div>
          </div>
          {settings.rooms && (
            <SandboxRooms
              room={roomView}
              bots={roomView ? rooms.current.bots() : []}
              turnBot={(() => {
                const id = roomView ? rooms.current.turnPlayerId() : null;
                return id && id !== ME.id ? (rooms.current.bots().find((b) => b.id === id) ?? null) : null;
              })()}
              gameInRoom={gameInRoom(roomView)}
              onAction={botAction}
            />
          )}
          <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
            <h2 className="mb-2 font-semibold">{t("checklist")}</h2>
            <ul data-testid="sandbox-checklist" className="grid grid-cols-2 gap-1">
              {CHECKS.map((c) => (
                <li key={c} data-ok={seen[c] ? "1" : "0"} className={seen[c] ? "text-neon-lime" : "text-muted"}>
                  {seen[c] ? "✓" : "○"} {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              <h2 className="text-sm font-semibold">{t("log")}</h2>
              <button type="button" onClick={() => setLog([])} className="text-xs text-muted hover:text-ink">
                {t("clear")}
              </button>
            </div>
            <ol data-testid="sandbox-log" className="max-h-96 overflow-y-auto font-mono text-xs">
              {log.length === 0 && <li className="px-4 py-3 text-muted">{t("logEmpty")}</li>}
              {log.map((l, i) => (
                <li key={i} className={`border-b border-line/50 px-4 py-1.5 ${l.dir === "warn" ? "text-neon-pink" : ""}`}>
                  <span className="text-muted">{l.at}</span>{" "}
                  <span className="font-semibold">
                    {l.dir === "in" ? "← " : l.dir === "out" ? "→ " : "⚠ "}
                    {l.type}
                  </span>{" "}
                  <span className="break-all text-muted">{l.payload}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
