"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";
import { Field, ghostBtn, inputCls, primaryBtn, Section, useErrorText } from "./shared";

type Token = { id: string; name: string; prefix: string; lastUsedAt: string | null; expiresAt: string | null; createdAt: string };

/** Token cho CLI / CI: `npx @monlabs/cli deploy` đẩy bản build không cần qua web */
export function DevTokens() {
  const t = useTranslations("devTokens");
  const errorText = useErrorText();
  const locale = useLocale();
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [name, setName] = useState("");
  const [days, setDays] = useState("90");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium" });

  const load = useCallback(() => {
    apiFetch<{ tokens: Token[] }>("/developer/tokens").then((r) => setTokens(r.tokens), () => setTokens([]));
  }, []);
  useEffect(load, [load]);

  return (
    <Section title={t("title")}>
      <p className="mb-3 text-sm text-muted">{t("intro")}</p>
      <pre className="mb-4 overflow-x-auto rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs">
        {"npx @monlabs/cli login\nnpx @monlabs/cli deploy ./dist --game <slug> --version 1.0.1"}
      </pre>

      {created && (
        <div data-testid="new-token" className="mb-4 rounded-lg border border-neon-lime/50 bg-neon-lime/10 p-3 text-sm">
          <p className="font-semibold text-neon-lime">{t("createdTitle")}</p>
          <p className="mt-1 text-muted">{t("createdHint")}</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={created} onFocus={(e) => e.currentTarget.select()} className={`${inputCls} font-mono text-xs`} />
            <button
              type="button"
              className={ghostBtn}
              onClick={() => void navigator.clipboard.writeText(created).then(() => setCopied(true), () => undefined)}
            >
              {copied ? "✓" : t("copy")}
            </button>
          </div>
        </div>
      )}

      <form
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            const { token } = await apiFetch<{ token: { token: string } }>("/developer/tokens", {
              method: "POST",
              json: { name: name.trim() || "CLI", ...(days ? { expiresInDays: Number(days) } : {}) },
            });
            setCreated(token.token);
            setCopied(false);
            setName("");
            load();
          } catch (err) {
            setError(errorText(errorCode(err)));
          }
        }}
      >
        <Field label={t("name")}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="GitHub Actions" className={inputCls} />
        </Field>
        <Field label={t("expires")}>
          <select value={days} onChange={(e) => setDays(e.target.value)} className={inputCls}>
            <option value="30">30 {t("days")}</option>
            <option value="90">90 {t("days")}</option>
            <option value="365">365 {t("days")}</option>
            <option value="">{t("never")}</option>
          </select>
        </Field>
        <button type="submit" className={primaryBtn}>
          {t("create")}
        </button>
        {error && <span role="alert" className="text-sm text-neon-pink">{error}</span>}
      </form>

      <ul className="divide-y divide-line/60 text-sm">
        {tokens?.length === 0 && <li className="py-2 text-muted">{t("empty")}</li>}
        {tokens?.map((tk) => (
          <li key={tk.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="font-semibold">{tk.name}</span>
            <span className="font-mono text-xs text-muted">{tk.prefix}…</span>
            <span className="text-xs text-muted">
              {tk.lastUsedAt ? t("lastUsed", { date: date.format(new Date(tk.lastUsedAt)) }) : t("neverUsed")}
              {tk.expiresAt ? ` · ${t("expiresOn", { date: date.format(new Date(tk.expiresAt)) })}` : ""}
            </span>
            <button
              type="button"
              className="ml-auto text-xs font-semibold text-neon-pink hover:underline"
              onClick={async () => {
                await apiFetch(`/developer/tokens/${tk.id}`, { method: "DELETE" }).catch(() => undefined);
                load();
              }}
            >
              {t("revoke")}
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
