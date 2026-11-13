"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";
import { ghostBtn, inputCls, primaryBtn, Section, useErrorText } from "./shared";

type Delivery = {
  id: string;
  event: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
};
type Config = { url: string | null; hasSecret: boolean; secretHint: string | null; deliveries: Delivery[] };

/** Webhook: máy chủ của game nhận sự kiện score.submitted (ký HMAC, tự gửi lại khi lỗi) */
export function WebhookSettings({ gameId }: { gameId: string }) {
  const t = useTranslations("developer.webhook");
  const locale = useLocale();
  const errorText = useErrorText();
  const [config, setConfig] = useState<Config | null>(null);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "medium" });

  const load = useCallback(async () => {
    try {
      const c = await apiFetch<Config>(`/developer/games/${gameId}/webhook`);
      setConfig(c);
      setUrl((prev) => prev || c.url || "");
    } catch (err) {
      setMessage({ ok: false, text: errorText(errorCode(err)) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await action() });
      await load();
    } catch (err) {
      setMessage({ ok: false, text: errorText(errorCode(err)) });
    } finally {
      setBusy(false);
    }
  }

  function statusText(d: Delivery) {
    if (d.status === "SUCCEEDED") return t("status.SUCCEEDED", { code: d.lastStatusCode ?? 200 });
    if (d.status === "FAILED") return t("status.FAILED", { error: d.lastError ?? "" });
    if (d.attempts === 0) return t("status.QUEUED");
    return t("status.RETRYING", {
      error: d.lastError ?? "",
      at: d.nextAttemptAt ? date.format(new Date(d.nextAttemptAt)) : "",
    });
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
            void act(async () => {
              const res = await apiFetch<{ url: string | null; secret: string | null }>(`/developer/games/${gameId}/webhook`, {
                method: "PUT",
                json: { url: url.trim() || null },
              });
              if (res.secret) setSecret(res.secret);
              setUrl(res.url ?? "");
              return res.url ? t("saved") : t("disabled");
            });
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("url")}</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.mygame.io/monlabs/webhook"
              className={`${inputCls} font-mono`}
            />
            <span className="text-xs text-muted">{t("urlHint")}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={primaryBtn}>
              {t("save")}
            </button>
            {config?.url && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  className={ghostBtn}
                  onClick={() =>
                    void act(async () => {
                      const res = await apiFetch<{ delivery: Delivery | null }>(`/developer/games/${gameId}/webhook/test`, {
                        method: "POST",
                      });
                      return res.delivery?.status === "SUCCEEDED" ? t("testOk") : t("testFail", { error: res.delivery?.lastError ?? "" });
                    })
                  }
                >
                  {t("test")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={ghostBtn}
                  onClick={() =>
                    void act(async () => {
                      const res = await apiFetch<{ secret: string }>(`/developer/games/${gameId}/webhook/rotate`, { method: "POST" });
                      setSecret(res.secret);
                      return t("rotated");
                    })
                  }
                >
                  {t("rotate")}
                </button>
              </>
            )}
          </div>
        </form>

        {secret ? (
          <div className="rounded-lg border border-neon-pink/50 bg-neon-pink/5 p-3 text-sm">
            <p className="mb-1 font-medium text-neon-pink">{t("secretTitle")}</p>
            <code data-testid="webhook-secret" className="block break-all font-mono text-ink">
              {secret}
            </code>
            <p className="mt-1 text-xs text-muted">{t("secretHint")}</p>
          </div>
        ) : (
          config?.secretHint && (
            <p className="text-xs text-muted">
              {t("secretKept")} <code className="font-mono">{config.secretHint}</code>
            </p>
          )
        )}

        {config && config.deliveries.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t("deliveries")}</h3>
            <ul data-testid="webhook-deliveries" className="divide-y divide-line/60 rounded-lg border border-line text-sm">
              {config.deliveries.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <span className="font-mono">{d.event}</span>{" "}
                    <span
                      className={`text-xs ${
                        d.status === "SUCCEEDED" ? "text-neon-lime" : d.status === "FAILED" ? "text-neon-pink" : "text-muted"
                      }`}
                    >
                      {d.status === "SUCCEEDED" ? "✓ " : d.status === "FAILED" ? "✕ " : "… "}
                      {statusText(d)}
                    </span>
                    <p className="text-xs text-muted">
                      {date.format(new Date(d.createdAt))} · {t("attempts", { n: d.attempts })}
                    </p>
                  </div>
                  {d.status !== "SUCCEEDED" && (
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-ink"
                      onClick={() =>
                        void act(async () => {
                          const res = await apiFetch<{ delivery: Delivery | null }>(
                            `/developer/games/${gameId}/webhook/deliveries/${d.id}/retry`,
                            { method: "POST" },
                          );
                          return res.delivery?.status === "SUCCEEDED" ? t("testOk") : t("testFail", { error: res.delivery?.lastError ?? "" });
                        })
                      }
                    >
                      {t("retry")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}
