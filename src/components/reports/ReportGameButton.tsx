"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch, errorCode } from "@/lib/client-api";

const REASONS = ["BROKEN", "INAPPROPRIATE", "COPYRIGHT", "CHEATING", "OTHER"] as const;

/** Nút "Báo cáo" dưới khung game → form chọn lý do */
export function ReportGameButton({ slug }: { slug: string }) {
  const t = useTranslations("report");
  const { user, login } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("BROKEN");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<{ step: "form" | "sending" | "done"; error?: string }>({ step: "form" });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-neon-pink/60 hover:text-neon-pink"
      >
        ⚑ {t("button")}
      </button>
    );
  }

  const close = () => {
    setOpen(false);
    setState({ step: "form" });
    setMessage("");
  };

  return (
    <div role="dialog" aria-label={t("title")} className="w-full rounded-xl border border-neon-pink/40 bg-surface p-4 text-sm">
      {state.step === "done" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-neon-lime">{t("thanks")}</p>
          <button type="button" onClick={close} className="text-muted hover:text-ink">
            {t("close")}
          </button>
        </div>
      ) : !user ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted">{t("loginRequired")}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => void login()} className="rounded-lg border border-neon/60 px-3 py-1.5 font-semibold text-neon">
              {t("connect")}
            </button>
            <button type="button" onClick={close} className="px-2 text-muted hover:text-ink">
              {t("close")}
            </button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setState({ step: "sending" });
            try {
              await apiFetch(`/games/${slug}/reports`, { method: "POST", json: { reason, message: message.trim() || undefined } });
              setState({ step: "done" });
            } catch (err) {
              const code = errorCode(err);
              setState({ step: "form", error: t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.UNKNOWN") });
            }
          }}
        >
          <h3 className="font-semibold">{t("title")}</h3>
          <fieldset className="flex flex-col gap-1.5">
            {REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2">
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-neon-pink" />
                {t(`reasons.${r}`)}
              </label>
            ))}
          </fieldset>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={t("messagePlaceholder")}
            className="rounded-lg border border-line bg-bg px-3 py-2 outline-none focus:border-neon"
          />
          {state.error && <p className="text-neon-pink">{state.error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={state.step === "sending"}
              className="rounded-lg bg-neon-pink px-4 py-2 font-semibold text-bg disabled:opacity-60"
            >
              {t("submit")}
            </button>
            <button type="button" onClick={close} className="text-muted hover:text-ink">
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
