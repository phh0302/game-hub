"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { reportClientError } from "@/lib/report-client-error";

/** Lỗi khi hiển thị trang: báo về server + cho người dùng thử lại */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");
  useEffect(() => {
    reportClientError(error, "page");
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted">{t("description")}</p>
      {error.digest && <p className="font-mono text-xs text-muted">{t("code", { digest: error.digest })}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="rounded-lg bg-neon px-4 py-2 text-sm font-semibold text-bg">
          {t("retry")}
        </button>
        <a href="/" className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink">
          {t("home")}
        </a>
      </div>
    </div>
  );
}
