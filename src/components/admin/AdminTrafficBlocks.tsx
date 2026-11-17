"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, errorCode } from "@/lib/client-api";

type Block = { ip: string; until: number; at: number | null; group: string | null };

/** IP đang bị chặn tạm vì gửi request dồn dập – bỏ chặn ngay trên trang */
export function AdminTrafficBlocks() {
  const t = useTranslations("adminTraffic");
  const locale = useLocale();
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const time = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { timeStyle: "short", dateStyle: "short" });

  const load = useCallback(async () => {
    try {
      setBlocks((await apiFetch<{ blocks: Block[] }>("/admin/traffic/blocks")).blocks);
    } catch (err) {
      setMsg(t("error", { code: errorCode(err) }));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function unblock(ip: string) {
    try {
      await apiFetch(`/admin/traffic/blocks?ip=${encodeURIComponent(ip)}`, { method: "DELETE" });
      setMsg(t("unblocked", { ip }));
      await load();
    } catch (err) {
      setMsg(t("error", { code: errorCode(err) }));
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface" data-testid="traffic-blocks">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{t("title")}</h2>
          <p className="text-xs text-muted">{t("hint")}</p>
        </div>
        <button type="button" onClick={() => void load()} className="text-xs text-muted hover:text-ink">
          {t("refresh")}
        </button>
      </header>
      {msg && <p className="px-5 pt-3 text-sm text-neon-lime">{msg}</p>}
      {blocks && blocks.length === 0 && <p className="px-5 py-4 text-sm text-muted">{t("empty")}</p>}
      <ul className="divide-y divide-line">
        {blocks?.map((b) => (
          <li key={b.ip} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
            <span className="font-mono">{b.ip}</span>
            <span className="text-xs text-muted">
              {b.group ? `${b.group} · ` : ""}
              {t("until", { time: time.format(new Date(b.until)) })}
            </span>
            <button
              type="button"
              onClick={() => void unblock(b.ip)}
              className="rounded-md border border-line px-3 py-1 text-xs text-muted hover:text-ink"
            >
              {t("unblock")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
