"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";
import { ghostBtn, inputCls, primaryBtn, Section, useErrorText } from "./shared";

type ApiKey = { id: string; kind: "PUBLISHABLE" | "SECRET"; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

/** Platform API: cho game chạy trên domain riêng dùng đăng nhập ví, bảng xếp hạng, giải đấu của hub */
export function ApiIntegration({
  gameId,
  origins: initialOrigins,
  scoreSubmission: initialScoring,
}: {
  gameId: string;
  origins: string[];
  scoreSubmission: "client" | "server";
}) {
  const t = useTranslations("developer.api");
  const locale = useLocale();
  const errorText = useErrorText();
  const [origins, setOrigins] = useState(initialOrigins.join("\n"));
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [newKey, setNewKey] = useState<{ key: string; kind: ApiKey["kind"] } | null>(null);
  const [scoring, setScoring] = useState(initialScoring);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short" });
  const hubOrigin = typeof window === "undefined" ? "" : window.location.origin;

  const loadKeys = useCallback(async () => {
    try {
      setKeys((await apiFetch<{ keys: ApiKey[] }>(`/developer/games/${gameId}/keys`)).keys);
    } catch (err) {
      setMessage({ ok: false, text: errorText(errorCode(err)) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function act(action: () => Promise<unknown>, okText: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: okText });
    } catch (err) {
      setMessage({ ok: false, text: errorText(errorCode(err)) });
    } finally {
      setBusy(false);
    }
  }

  const activeKey = keys?.find((k) => !k.revokedAt && k.kind === "PUBLISHABLE");
  const snippetKey = newKey?.kind === "PUBLISHABLE" ? newKey.key : activeKey ? `${activeKey.prefix}…` : "pk_live_…";

  function createKey(kind: ApiKey["kind"]) {
    void act(async () => {
      const res = await apiFetch<{ key: string }>(`/developer/games/${gameId}/keys`, { method: "POST", json: { kind } });
      setNewKey({ key: res.key, kind });
      await loadKeys();
    }, t("keyCreated"));
  }

  return (
    <Section title={t("title")}>
      <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("intro")}</p>

      {message && (
        <p role="status" className={`text-sm ${message.ok ? "text-neon-lime" : "text-neon-pink"}`}>
          {message.text}
        </p>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const list = origins
            .split(/[\s,]+/)
            .map((o) => o.trim())
            .filter(Boolean);
          void act(async () => {
            const { game } = await apiFetch<{ game: { allowedOrigins: string[] } }>(`/developer/games/${gameId}`, {
              method: "PATCH",
              json: { allowedOrigins: list },
            });
            setOrigins(game.allowedOrigins.join("\n"));
          }, t("originsSaved"));
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("origins")}</span>
          <textarea
            value={origins}
            onChange={(e) => setOrigins(e.target.value)}
            rows={3}
            placeholder={"https://mygame.io\nhttp://localhost:5173"}
            className={`${inputCls} font-mono`}
          />
          <span className="text-xs text-muted">{t("originsHint")}</span>
        </label>
        <button type="submit" disabled={busy} className={`${ghostBtn} self-start`}>
          {t("saveOrigins")}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("keys")}</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={primaryBtn} onClick={() => createKey("PUBLISHABLE")}>
              + {t("createKey")}
            </button>
            <button type="button" disabled={busy} className={ghostBtn} onClick={() => createKey("SECRET")}>
              + {t("createSecretKey")}
            </button>
          </div>
        </div>

        {newKey && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              newKey.kind === "SECRET" ? "border-neon-pink/50 bg-neon-pink/5" : "border-neon-lime/40 bg-neon-lime/5"
            }`}
          >
            <p className={`mb-1 font-medium ${newKey.kind === "SECRET" ? "text-neon-pink" : "text-neon-lime"}`}>
              {t("newKeyTitle")}
            </p>
            <code data-testid="new-api-key" className="block break-all font-mono text-ink">
              {newKey.key}
            </code>
            <p className="mt-1 text-xs text-muted">{newKey.kind === "SECRET" ? t("newSecretHint") : t("newKeyHint")}</p>
          </div>
        )}

        {keys && keys.length === 0 && <p className="text-sm text-muted">{t("noKeys")}</p>}
        {keys && keys.length > 0 && (
          <ul className="divide-y divide-line/60 rounded-lg border border-line">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div>
                  <code className={`font-mono ${k.revokedAt ? "text-muted line-through" : ""}`}>{k.prefix}…</code>{" "}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      k.kind === "SECRET" ? "bg-neon-pink/15 text-neon-pink" : "bg-neon-lime/15 text-neon-lime"
                    }`}
                  >
                    {k.kind === "SECRET" ? t("kindSecret") : t("kindPublishable")}
                  </span>
                  <p className="text-xs text-muted">
                    {t("createdAt", { date: date.format(new Date(k.createdAt)) })} ·{" "}
                    {k.revokedAt
                      ? t("revokedAt", { date: date.format(new Date(k.revokedAt)) })
                      : k.lastUsedAt
                        ? t("lastUsed", { date: date.format(new Date(k.lastUsedAt)) })
                        : t("neverUsed")}
                  </p>
                </div>
                {!k.revokedAt &&
                  (confirmRevoke === k.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neon-pink">{t("revokeConfirmText")}</span>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-lg bg-neon-pink px-3 py-1 text-xs font-semibold text-bg"
                        onClick={() =>
                          void act(async () => {
                            await apiFetch(`/developer/games/${gameId}/keys/${k.id}`, { method: "DELETE" });
                            setConfirmRevoke(null);
                            await loadKeys();
                          }, t("keyRevoked"))
                        }
                      >
                        {t("revokeConfirm")}
                      </button>
                      <button type="button" className="text-xs text-muted" onClick={() => setConfirmRevoke(null)}>
                        {t("cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="rounded-lg border border-neon-pink/50 px-3 py-1 text-xs text-neon-pink"
                      onClick={() => setConfirmRevoke(k.id)}
                    >
                      {t("revoke")}
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            const { game } = await apiFetch<{ game: { scoreSubmission: "client" | "server" } }>(`/developer/games/${gameId}`, {
              method: "PATCH",
              json: { scoreSubmission: scoring },
            });
            setScoring(game.scoreSubmission);
          }, t("scoringSaved"));
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("scoring")}</span>
          <select
            value={scoring}
            onChange={(e) => setScoring(e.target.value as "client" | "server")}
            className={inputCls}
          >
            <option value="client">{t("scoringClient")}</option>
            <option value="server">{t("scoringServer")}</option>
          </select>
          <span className="text-xs text-muted">{t("scoringHint")}</span>
        </label>
        <button type="submit" disabled={busy} className={`${ghostBtn} self-start`}>
          {t("saveScoring")}
        </button>
      </form>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{t("snippetTitle")}</h3>
        <pre className="overflow-x-auto rounded-lg border border-line bg-bg p-3 font-mono text-xs leading-relaxed">
          {`<script src="${hubOrigin}/sdk/gamehub-sdk.js"></script>
<script>
  await GameHub.init({ projectKey: "${snippetKey}" });
  await GameHub.login();            // ${t("snippetLogin")}
  GameHub.gameStart();
  const result = await GameHub.gameOver(score);
  const top = await GameHub.leaderboard({ period: "week" });
</script>`}
        </pre>
        <h3 className="mt-2 text-sm font-semibold">{t("serverSnippetTitle")}</h3>
        <pre className="overflow-x-auto rounded-lg border border-line bg-bg p-3 font-mono text-xs leading-relaxed">
          {`// ${t("serverSnippetComment")}
await fetch("${hubOrigin}/api/s1/scores", {
  method: "POST",
  headers: {
    authorization: "Bearer " + process.env.MONLABS_SECRET_KEY,
    "content-type": "application/json",
  },
  body: JSON.stringify({ sessionId, score }),
});`}
        </pre>
      </div>
      </div>
    </Section>
  );
}
