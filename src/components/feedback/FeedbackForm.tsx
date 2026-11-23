"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";

const CATEGORIES = ["BUG", "IDEA", "OTHER"] as const;
type Category = (typeof CATEGORIES)[number];

/** Form góp ý: loại, nội dung, email (không bắt buộc) – gửi tới /api/v1/feedback */
export function FeedbackForm({ from }: { from?: string }) {
  const t = useTranslations("contact");
  const [category, setCategory] = useState<Category>("IDEA");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<{ step: "form" | "sending" | "done"; error?: string }>({ step: "form" });

  if (state.step === "done") {
    return (
      <div data-testid="feedback-done" className="rounded-2xl border border-neon-lime/40 bg-surface p-6 text-center">
        <p className="font-semibold text-neon-lime">{t("done.title")}</p>
        <p className="mt-1 text-sm text-muted">{t("done.body")}</p>
        <button
          type="button"
          onClick={() => {
            setMessage("");
            setState({ step: "form" });
          }}
          className="mt-4 text-sm font-semibold text-neon hover:underline"
        >
          {t("done.again")}
        </button>
      </div>
    );
  }

  return (
    <form
      data-testid="feedback-form"
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (message.trim().length < 5) {
          setState({ step: "form", error: t("errors.TOO_SHORT") });
          return;
        }
        setState({ step: "sending" });
        try {
          await apiFetch("/feedback", {
            method: "POST",
            json: { category, message: message.trim(), email: email.trim(), page: from, website },
          });
          setState({ step: "done" });
        } catch (err) {
          const code = errorCode(err);
          setState({ step: "form", error: t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.UNKNOWN") });
        }
      }}
    >
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-sm font-semibold">{t("category")}</legend>
        {CATEGORIES.map((c) => (
          <label
            key={c}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
              category === c ? "border-neon bg-neon/10 text-ink" : "border-line text-muted hover:text-ink"
            }`}
          >
            <input type="radio" name="category" value={c} checked={category === c} onChange={() => setCategory(c)} className="sr-only" />
            {t(`categories.${c}`)}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">{t("message")}</span>
        <textarea
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          rows={5}
          required
          placeholder={t("messagePlaceholder")}
          className="rounded-lg border border-line bg-bg px-3 py-2 outline-none focus:border-neon"
        />
        <span className="self-end text-xs text-muted">{message.length}/2000</span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">
          {t("email")} <span className="font-normal text-muted">({t("optional")})</span>
        </span>
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
          placeholder="ban@example.com"
          className="rounded-lg border border-line bg-bg px-3 py-2 outline-none focus:border-neon"
        />
        <span className="text-xs text-muted">{t("emailHint")}</span>
      </label>

      {/* Ô bẫy bot: ẩn với người dùng */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      {state.error && (
        <p role="status" className="text-sm text-neon-pink">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={state.step === "sending"}
        className="self-start rounded-lg bg-linear-to-r from-neon to-neon-pink px-5 py-2 font-semibold text-bg disabled:opacity-60"
      >
        {state.step === "sending" ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
