"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const KEY = "gh_age18_ok";

/** Game 18+: hỏi xác nhận tuổi 1 lần (nhớ trên máy) trước khi tải game */
export function AgeGate({ rating, children }: { rating: string; children: ReactNode }) {
  const t = useTranslations("age");
  const [ok, setOk] = useState<boolean | null>(rating === "AGE_18" ? null : true);

  useEffect(() => {
    if (rating !== "AGE_18") return;
    try {
      setOk(window.localStorage.getItem(KEY) === "1");
    } catch {
      setOk(false);
    }
  }, [rating]);

  if (ok) return <>{children}</>;
  if (ok === null) return <div className="aspect-video rounded-2xl border border-line bg-surface" />;
  return (
    <div data-testid="age-gate" className="grid aspect-video place-items-center rounded-2xl border border-neon-pink/40 bg-surface p-6 text-center">
      <div className="max-w-md">
        <p className="font-display text-4xl font-bold text-neon-pink">18+</p>
        <h2 className="mt-2 font-display text-xl font-semibold">{t("title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("body")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.setItem(KEY, "1");
              } catch {
                // không lưu được thì hỏi lại lần sau
              }
              setOk(true);
            }}
            className="rounded-lg bg-linear-to-r from-neon to-neon-pink px-5 py-2 font-semibold text-bg"
          >
            {t("confirm")}
          </button>
          <Link href="/" className="rounded-lg border border-line px-5 py-2 font-semibold text-muted hover:text-ink">
            {t("leave")}
          </Link>
        </div>
      </div>
    </div>
  );
}
