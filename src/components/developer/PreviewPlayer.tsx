"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { displayName } from "@/lib/format";
import { StatusBadge } from "./shared";

const PROTOCOL = "gamehub";
const PROTOCOL_VERSION = 1;

type LogLine = { at: string; type: string; payload: string; ok: boolean };

/**
 * Chơi thử 1 phiên bản: chạy y như trên hub (iframe sandbox + SDK) nhưng KHÔNG lưu điểm,
 * và hiện nhật ký tin nhắn SDK để developer kiểm tra game đã tích hợp đúng chưa.
 */
export function PreviewPlayer({
  playUrl,
  gameName,
  version,
  status,
  studioName,
  releaseNotes,
}: {
  playUrl: string;
  gameName: string;
  version: string;
  status: string;
  studioName: string;
  releaseNotes: string | null;
}) {
  const t = useTranslations("preview");
  const locale = useLocale();
  const { user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const ctx = useRef({ locale, user, t });
  ctx.current = { locale, user, t };

  useEffect(() => {
    const post = (type: string, payload: Record<string, unknown>) =>
      iframeRef.current?.contentWindow?.postMessage({ source: PROTOCOL, v: PROTOCOL_VERSION, type, payload }, "*");
    const add = (type: string, payload: unknown, ok = true) =>
      setLog((l) => [{ at: new Date().toLocaleTimeString(), type, payload: JSON.stringify(payload ?? {}), ok }, ...l].slice(0, 100));

    function onMessage(event: MessageEvent) {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const msg = event.data as { source?: string; v?: number; type?: string; payload?: Record<string, unknown> };
      if (!msg || msg.source !== PROTOCOL) return;
      if (msg.v !== PROTOCOL_VERSION || typeof msg.type !== "string") {
        add("⚠ INVALID", msg, false);
        return;
      }
      const payload = msg.payload ?? {};
      const { locale: loc, user: u, t: tr } = ctx.current;
      add(`← ${msg.type}`, payload);

      switch (msg.type) {
        case "READY": {
          const init = {
            protocolVersion: PROTOCOL_VERSION,
            standalone: false,
            locale: loc,
            player: u ? { displayName: displayName(u) } : null,
            canSubmitScore: false,
          };
          post("INIT", init);
          add("→ INIT", init);
          break;
        }
        case "GAME_OVER": {
          const score = Number(payload.score);
          const valid = Number.isInteger(score) && score >= 0;
          if (!valid) add("⚠ GAME_OVER", tr("badScore"), false);
          const result = { saved: false, code: "PREVIEW", message: tr("notSaved", { score: valid ? score : "?" }) };
          post("SCORE_RESULT", result);
          add("→ SCORE_RESULT", result);
          break;
        }
        case "AD_REQUEST": {
          const result = { requestId: payload.requestId, shown: false, rewarded: false, reason: "NO_ADS" };
          post("AD_RESULT", result);
          add("→ AD_RESULT", result);
          break;
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const sawReady = log.some((l) => l.type === "← READY");
  const sawStart = log.some((l) => l.type === "← GAME_START");
  const sawOver = log.some((l) => l.type === "← GAME_OVER");

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-neon/40 bg-neon/5 px-4 py-3 text-sm">
        <strong className="text-neon">{t("title")}</strong> · {t("banner")}
      </div>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">{gameName}</h1>
        <span className="font-mono text-sm text-muted">v{version}</span>
        <StatusBadge status={status} kind="version" />
        <span className="text-sm text-muted">· {studioName}</span>
      </header>
      {releaseNotes && <p className="text-sm text-muted">{releaseNotes}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-bg">
          <iframe
            ref={iframeRef}
            src={playUrl}
            title={gameName}
            sandbox="allow-scripts allow-pointer-lock"
            allow="autoplay; gamepad; fullscreen"
            referrerPolicy="no-referrer"
            onLoad={() => iframeRef.current?.focus()}
            className="block h-[min(78vh,720px)] min-h-[480px] w-full"
          />
        </div>

        <aside className="flex flex-col gap-3">
          <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
            <h2 className="mb-2 font-semibold">{t("checklist")}</h2>
            <ul className="flex flex-col gap-1.5">
              {[
                ["READY", sawReady],
                ["GAME_START", sawStart],
                ["GAME_OVER", sawOver],
              ].map(([name, ok]) => (
                <li key={name as string} className={ok ? "text-neon-lime" : "text-muted"}>
                  {ok ? "✓" : "○"} {t(`check.${name}`)}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-line bg-surface">
            <h2 className="border-b border-line px-4 py-2 text-sm font-semibold">{t("log")}</h2>
            <ol className="max-h-96 overflow-y-auto font-mono text-xs">
              {log.length === 0 && <li className="px-4 py-3 text-muted">{t("logEmpty")}</li>}
              {log.map((l, i) => (
                <li key={i} className={`border-b border-line/50 px-4 py-1.5 ${l.ok ? "" : "text-neon-pink"}`}>
                  <span className="text-muted">{l.at}</span> <span className="font-semibold">{l.type}</span>{" "}
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
