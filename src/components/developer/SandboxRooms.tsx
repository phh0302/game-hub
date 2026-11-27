"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MockRoomView } from "@/modules/rooms/mock";

export type BotAction =
  | { kind: "host" }
  | { kind: "join" }
  | { kind: "start" }
  | { kind: "move"; data: unknown; state?: unknown; next?: "next" | "same"; finish?: { winnerSeat: number | null } }
  | { kind: "leave"; id: string }
  | { kind: "openInvite" }
  | { kind: "reset" };

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  if (!text.trim()) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * Bảng điều khiển phòng giả lập: dev đóng vai "người chơi ảo" (ghế khác) để thử luồng nhiều người trên 1 máy –
 * tạo phòng / vào phòng, bắt đầu, đi lượt, rời phòng, mở game như khi bạn bè bấm link mời.
 */
export function SandboxRooms({
  room,
  bots,
  turnBot,
  gameInRoom,
  onAction,
}: {
  room: MockRoomView | null;
  bots: { id: string; name: string; seat: number }[];
  turnBot: { id: string; name: string; seat: number } | null;
  gameInRoom: boolean;
  onAction: (a: BotAction) => string | null;
}) {
  const t = useTranslations("sandbox.rooms");
  const [data, setData] = useState('{ "cell": 0 }');
  const [state, setState] = useState("");
  const [next, setNext] = useState<"next" | "same">("next");
  const [finish, setFinish] = useState(false);
  const [winner, setWinner] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = (a: BotAction) => setError(onAction(a));
  const btn = "rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:border-neon hover:text-ink disabled:opacity-40";
  const host = room?.players.find((p) => p.host);
  const hostIsBot = Boolean(host && bots.some((b) => b.seat === host.seat) && !host.left);
  const free = room ? room.maxPlayers - room.players.filter((p) => !p.left).length : 0;

  const sendMove = () => {
    const d = parseJson(data);
    const s = parseJson(state);
    if (!d.ok || d.value === undefined) return setError(t("badData"));
    if (!s.ok) return setError(t("badState"));
    const w = winner.trim() === "" ? null : Number(winner);
    if (finish && w !== null && !Number.isInteger(w)) return setError(t("badWinner"));
    run({ kind: "move", data: d.value, state: s.value, next, finish: finish ? { winnerSeat: w } : undefined });
  };

  return (
    <div data-testid="sandbox-rooms" className="rounded-2xl border border-line bg-surface p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">{t("title")}</h2>
        {room && (
          <button type="button" className={btn} onClick={() => run({ kind: "reset" })}>
            {t("reset")}
          </button>
        )}
      </div>

      {!room ? (
        <div className="flex flex-col gap-2 text-xs text-muted">
          <p>{t("empty")}</p>
          <button type="button" data-testid="sandbox-bot-host" className={btn} onClick={() => run({ kind: "host" })}>
            {t("botHost")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs">
            <span className="font-mono text-base font-bold tracking-widest" data-testid="sandbox-room-code">
              {room.code}
            </span>{" "}
            · <span data-testid="sandbox-room-status">{room.status}</span> · seq {room.seq}
            {room.turnDeadline && room.status === "PLAYING" && <> · {t("deadline", { time: new Date(room.turnDeadline).toLocaleTimeString() })}</>}
          </p>
          <ul className="grid gap-0.5 text-xs">
            {room.players.map((p) => (
              <li key={p.seat} className={p.left ? "text-muted line-through" : ""}>
                {room.status === "PLAYING" && room.turnSeat === p.seat ? "▶ " : "· "}
                {t("seat", { seat: p.seat })}: {p.name}
                {p.host ? ` (${t("host")})` : ""}
                {bots.some((b) => b.seat === p.seat) ? ` – ${t("bot")}` : ""}
              </li>
            ))}
          </ul>
          {!gameInRoom && room.status === "WAITING" && (
            <div className="rounded-lg border border-neon/30 bg-neon/5 p-2 text-xs">
              <p className="text-muted">{t("joinHint", { code: room.code })}</p>
              <button type="button" data-testid="sandbox-open-invite" className={`${btn} mt-1.5`} onClick={() => run({ kind: "openInvite" })}>
                {t("openInvite")}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {room.status === "WAITING" && free > 0 && (
              <button type="button" data-testid="sandbox-bot-join" className={btn} onClick={() => run({ kind: "join" })}>
                {t("botJoin")}
              </button>
            )}
            {room.status === "WAITING" && hostIsBot && (
              <button type="button" className={btn} onClick={() => run({ kind: "start" })}>
                {t("botStart")}
              </button>
            )}
            {bots.map((b) => (
              <button key={b.id} type="button" className={btn} onClick={() => run({ kind: "leave", id: b.id })} disabled={room.status === "FINISHED"}>
                {t("botLeave", { name: b.name })}
              </button>
            ))}
          </div>

          {turnBot && (
            <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-line p-2 text-xs">
              <p className="font-semibold">{t("botTurn", { name: turnBot.name, seat: turnBot.seat })}</p>
              <label className="flex flex-col gap-0.5">
                {t("data")}
                <textarea
                  data-testid="sandbox-bot-data"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  rows={2}
                  className="rounded border border-line bg-bg px-2 py-1 font-mono"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                {t("state")}
                <textarea value={state} onChange={(e) => setState(e.target.value)} rows={2} className="rounded border border-line bg-bg px-2 py-1 font-mono" />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1">
                  {t("next")}
                  <select value={next} onChange={(e) => setNext(e.target.value as "next" | "same")} className="rounded border border-line bg-bg px-1 py-0.5">
                    <option value="next">next</option>
                    <option value="same">same</option>
                  </select>
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={finish} onChange={() => setFinish((f) => !f)} />
                  {t("finish")}
                </label>
                {finish && (
                  <label className="flex items-center gap-1">
                    {t("winner")}
                    <input value={winner} onChange={(e) => setWinner(e.target.value)} placeholder="—" className="w-10 rounded border border-line bg-bg px-1 py-0.5" />
                  </label>
                )}
              </div>
              <button type="button" data-testid="sandbox-bot-move" className={btn} onClick={sendMove}>
                {t("botMove")}
              </button>
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-neon-pink">{error}</p>}
    </div>
  );
}
