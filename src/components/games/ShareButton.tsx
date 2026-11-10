"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatScore, type ScoreFormat } from "@/lib/score-format";

/**
 * Chia sẻ game / khoe điểm vừa đạt.
 * Điện thoại: mở bảng chia sẻ của máy (Zalo, Messenger…). Máy tính: copy link.
 * Link có ?score= → Facebook / Zalo hiện ảnh "Mình đạt X điểm" (xem /api/og).
 */
export function ShareButton({
  slug,
  gameName,
  score,
}: {
  slug: string;
  gameName: string;
  score: { value: number; format: ScoreFormat } | null;
}) {
  const t = useTranslations("share");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(`/games/${slug}`, window.location.origin);
    let text = t("gameText", { game: gameName });
    if (score) {
      url.searchParams.set("score", String(score.value));
      text = t(score.format === "duration_ms" ? "scoreTextTime" : "scoreText", {
        score: formatScore(score.value, score.format, locale),
        game: gameName,
      });
    }

    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: gameName, text, url: url.toString() });
        return;
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return; // người dùng đóng bảng chia sẻ
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(t("copyPrompt"), url.toString());
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        score ? "border-neon/60 font-semibold text-neon hover:bg-neon/10" : "border-line text-muted hover:text-ink"
      }`}
    >
      {copied ? `✓ ${t("copied")}` : score ? `↗ ${t("shareScore")}` : `↗ ${t("share")}`}
    </button>
  );
}
