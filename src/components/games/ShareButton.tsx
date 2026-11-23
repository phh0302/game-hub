"use client";

import { useTranslations } from "next-intl";

/** Nút "Chia sẻ" / "Khoe điểm" dưới khung game – mở bảng chia sẻ của hub (link kèm mã mời nếu đã đăng nhập) */
export function ShareButton({ hasScore, onClick }: { hasScore: boolean; onClick: () => void }) {
  const t = useTranslations("share");
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        hasScore ? "border-neon/60 font-semibold text-neon hover:bg-neon/10" : "border-line text-muted hover:text-ink"
      }`}
    >
      {hasScore ? `↗ ${t("shareScore")}` : `↗ ${t("share")}`}
    </button>
  );
}

/** Nút "Mời bạn" – link riêng của người chơi, bạn bè tạo tài khoản qua link được tính cho người mời */
export function InviteButton({ onClick, invited }: { onClick: () => void; invited: number | null }) {
  const t = useTranslations("share");
  return (
    <button type="button" onClick={onClick} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">
      + {t("invite")}
      {invited ? <span className="ml-1 text-xs text-neon-lime">({t("invitedCount", { count: invited })})</span> : null}
    </button>
  );
}
