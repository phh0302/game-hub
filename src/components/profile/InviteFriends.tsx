"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch } from "@/lib/client-api";
import { inviteUrl } from "@/modules/referrals/codes";

type Data = {
  code: string;
  invited: number;
  invitedBy: string | null;
  invitees: { name: string; game: string | null; at: string }[];
};

/** Hồ sơ: link mời của mình + bạn bè đã vào qua link */
export function InviteFriends() {
  const t = useTranslations("profile.invite");
  const locale = useLocale();
  const [data, setData] = useState<Data | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch<Data>("/me/invite?list=1").then(setData, () => undefined);
  }, []);

  if (!data) return null;
  const url = inviteUrl(window.location.origin, { code: data.code });
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium" });

  return (
    <section data-testid="invite-friends" className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-1 font-display text-xl font-semibold">{t("title")}</h2>
      <p className="mb-3 text-sm text-muted">{t("hint")}</p>
      <div className="flex gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs" />
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard.writeText(url).then(
              () => setCopied(true),
              () => undefined,
            )
          }
          className="shrink-0 rounded-lg border border-neon/60 px-3 py-2 text-sm font-semibold text-neon hover:bg-neon/10"
        >
          {copied ? `✓ ${t("copied")}` : t("copy")}
        </button>
      </div>
      <p className="mt-3 text-sm">
        {t("count", { count: data.invited })}
        {data.invitedBy && <span className="text-muted"> · {t("invitedBy", { name: data.invitedBy })}</span>}
      </p>
      {data.invitees.length > 0 && (
        <ul className="mt-2 divide-y divide-line/60 text-sm">
          {data.invitees.map((f, i) => (
            <li key={i} className="flex justify-between gap-3 py-1.5">
              <span>{f.name}</span>
              <span className="text-xs text-muted">
                {f.game ? `${f.game} · ` : ""}
                {date.format(new Date(f.at))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
