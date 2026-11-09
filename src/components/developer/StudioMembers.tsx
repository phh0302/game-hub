"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch, errorCode } from "@/lib/client-api";
import { shortAddress } from "@/lib/format";
import { inputCls, Section, useErrorText } from "./shared";

type Member = { userId: string; role: "OWNER" | "MEMBER"; joinedAt: string; walletAddress: string | null; displayName: string };

/** Thành viên studio: chủ studio thêm/bỏ thành viên, chuyển quyền; thành viên tự rời studio */
export function StudioMembers({ myRole, onLeft }: { myRole: "OWNER" | "MEMBER"; onLeft: () => void }) {
  const t = useTranslations("members");
  const locale = useLocale();
  const errorText = useErrorText();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const isOwner = myRole === "OWNER";
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "short" });

  const load = useCallback(async () => {
    try {
      setMembers((await apiFetch<{ members: Member[] }>("/developer/studio/members")).members);
    } catch (err) {
      setMessage({ ok: false, text: errorText(errorCode(err)) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: () => Promise<{ members: Member[] }>, okText: string, after?: () => void) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await action();
      setMembers(res.members);
      setMessage({ ok: true, text: okText });
      after?.();
    } catch (err) {
      setMessage({ ok: false, text: errorText(errorCode(err)) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t("title", { count: members.length })}>
      <ul className="divide-y divide-line/60">
        {members.map((m) => {
          const me = m.userId === user?.id;
          return (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <span className="font-semibold">{m.displayName}</span>
                {me && <span className="ml-1.5 text-xs text-neon">({t("you")})</span>}
                <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${m.role === "OWNER" ? "bg-neon-lime/15 text-neon-lime" : "bg-surface-2 text-muted"}`}>
                  {t(`role.${m.role}`)}
                </span>
                <p className="text-xs text-muted">
                  {m.walletAddress ? shortAddress(m.walletAddress) : "—"} · {t("joined", { date: date.format(new Date(m.joinedAt)) })}
                </p>
              </div>
              <div className="flex gap-2">
                {isOwner && !me && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        window.confirm(t("confirmTransfer", { name: m.displayName })) &&
                        void act(
                          () => apiFetch(`/developer/studio/members/${m.userId}/owner`, { method: "POST" }),
                          t("transferred"),
                          onLeft,
                        )
                      }
                      className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:text-ink disabled:opacity-50"
                    >
                      {t("makeOwner")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        window.confirm(t("confirmRemove", { name: m.displayName })) &&
                        void act(() => apiFetch(`/developer/studio/members/${m.userId}`, { method: "DELETE" }), t("removed"))
                      }
                      className="rounded-md border border-neon-pink/50 px-2.5 py-1 text-xs text-neon-pink hover:bg-neon-pink/10 disabled:opacity-50"
                    >
                      {t("remove")}
                    </button>
                  </>
                )}
                {!isOwner && me && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      window.confirm(t("confirmLeave")) &&
                      void act(() => apiFetch(`/developer/studio/members/${m.userId}`, { method: "DELETE" }), t("left"), onLeft)
                    }
                    className="rounded-md border border-neon-pink/50 px-2.5 py-1 text-xs text-neon-pink hover:bg-neon-pink/10 disabled:opacity-50"
                  >
                    {t("leave")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {isOwner && (
        <form
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              () => apiFetch("/developer/studio/members", { method: "POST", json: { walletAddress: wallet.trim() } }),
              t("added"),
              () => setWallet(""),
            );
          }}
        >
          <label className="flex min-w-72 flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("addLabel")}</span>
            <input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              required
              pattern="0x[0-9a-fA-F]{40}"
              placeholder="0x…"
              className={`${inputCls} font-mono`}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-neon/60 px-4 py-2 text-sm font-semibold text-neon hover:bg-neon/10 disabled:opacity-60"
          >
            {t("add")}
          </button>
          <p className="w-full text-xs text-muted">{t("addHint")}</p>
        </form>
      )}

      {message && (
        <p role="status" className={`mt-3 text-sm ${message.ok ? "text-neon-lime" : "text-neon-pink"}`}>
          {message.text}
        </p>
      )}
    </Section>
  );
}
