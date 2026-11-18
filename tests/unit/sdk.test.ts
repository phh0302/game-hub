import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

/** Chạy public/sdk/gamehub-sdk.js trong "trình duyệt giả": embedded = nằm trong khung sandbox của hub */
function loadSdk(embedded: boolean) {
  const src = fs.readFileSync(new URL("../../public/sdk/gamehub-sdk.js", import.meta.url), "utf8");
  const handlers: ((e: unknown) => void)[] = [];
  const sent: { type: string; payload: Record<string, unknown> }[] = [];
  const warns: string[] = [];
  const mem: Record<string, string> = {};
  const parent = { postMessage: (m: { type: string; payload: Record<string, unknown> }) => sent.push(m) };
  const win: Record<string, unknown> = {
    addEventListener: (t: string, h: (e: unknown) => void) => t === "message" && handlers.push(h),
    navigator: { language: "vi" },
    localStorage: {
      getItem: (k: string) => {
        if (embedded) throw new Error("SecurityError"); // origin "null" trong sandbox
        return mem[k] ?? null;
      },
      setItem: (k: string, v: string) => {
        if (embedded) throw new Error("SecurityError");
        mem[k] = v;
      },
    },
  };
  win.parent = embedded ? parent : win;
  vm.runInNewContext(src, {
    window: win,
    document: { currentScript: null },
    console: { ...console, warn: (m: string) => warns.push(m) },
    setTimeout,
    Promise,
    JSON,
    URL,
  });
  const hub = (type: string, payload: Record<string, unknown>) =>
    handlers.forEach((h) => h({ source: parent, data: { source: "gamehub", v: 1, type, payload } }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { G: win.GameHub as any, sent, hub, warns };
}

test("chế độ hub: gameOver() trả Promise kết quả + phát scoreResult", async () => {
  const { G, sent, hub } = loadSdk(true);
  let events = 0;
  G.on("scoreResult", () => events++);
  const p = G.gameOver(120);
  assert.equal(sent.at(-1)?.type, "GAME_OVER");
  hub("SCORE_RESULT", { saved: true, code: null, message: "ok", score: 120 });
  assert.deepEqual({ ...(await p) }, { saved: true, code: null, message: "ok", score: 120 });
  assert.equal(events, 1);
});

test("điểm không phải số → cảnh báo trong console, nộp 0", () => {
  const { G, sent, warns } = loadSdk(true);
  void G.gameOver("abc");
  assert.equal(sent.at(-1)?.payload.score, 0);
  assert.equal(warns.length, 1);
  void G.gameOver(12.9);
  assert.equal(sent.at(-1)?.payload.score, 12);
  assert.equal(warns.length, 1);
});

test("chế độ hub: saveState / loadState đi qua hub (localStorage của game bị chặn)", async () => {
  const { G, sent, hub } = loadSdk(true);
  const save = G.saveState({ level: 3 });
  const req = sent.at(-1)!;
  assert.equal(req.type, "STATE_SAVE");
  assert.equal(req.payload.data, '{"level":3}');
  hub("STATE_RESULT", { requestId: req.payload.requestId, saved: true, code: null });
  assert.deepEqual({ ...(await save) }, { saved: true, code: null });

  const load = G.loadState();
  hub("STATE_RESULT", { requestId: sent.at(-1)!.payload.requestId, data: '{"level":3}' });
  assert.deepEqual({ ...(await load) }, { level: 3 });

  assert.equal((await G.saveState("x".repeat(70_000))).code, "STATE_TOO_LARGE");
});

test("mở file trực tiếp: gameOver báo STANDALONE, saveState dùng localStorage của trang", async () => {
  const { G } = loadSdk(false);
  assert.equal((await G.gameOver(5)).code, "STANDALONE");
  assert.equal((await G.saveState({ a: 1 })).saved, true);
  assert.deepEqual({ ...(await G.loadState()) }, { a: 1 });
});
