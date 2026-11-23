import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

/** Chạy public/sdk/gamehub-sdk.js trong "trình duyệt giả": embedded = nằm trong khung sandbox của hub */
function loadSdk(embedded: boolean, nav: Record<string, unknown> = {}) {
  const src = fs.readFileSync(new URL("../../public/sdk/gamehub-sdk.js", import.meta.url), "utf8");
  const handlers: ((e: unknown) => void)[] = [];
  const sent: { type: string; payload: Record<string, unknown> }[] = [];
  const warns: string[] = [];
  const mem: Record<string, string> = {};
  const parent = { postMessage: (m: { type: string; payload: Record<string, unknown> }) => sent.push(m) };
  const win: Record<string, unknown> = {
    addEventListener: (t: string, h: (e: unknown) => void) => t === "message" && handlers.push(h),
    navigator: { language: "vi", ...nav },
    location: { href: "https://mygame.example/play#x" },
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
    clearTimeout,
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

test("/sdk/gamehub-sdk.js (mới nhất) trùng /sdk/v3/gamehub-sdk.js; v1, v2 giữ nguyên", () => {
  const read = (p: string) => fs.readFileSync(new URL(`../../public/sdk/${p}`, import.meta.url), "utf8");
  assert.equal(read("gamehub-sdk.js"), read("v3/gamehub-sdk.js"), "Sửa SDK thì chép sang public/sdk/v3/ (hoặc tạo v4 nếu phá tương thích)");
  assert.match(read("v1/gamehub-sdk.js"), /Game Hub SDK v1/);
  assert.match(read("v2/gamehub-sdk.js"), /Game Hub SDK v2/);
});

test("track(): gom sự kiện, flush() gửi TRACK lên hub; tên sai bị bỏ", async () => {
  const { G, sent, warns } = loadSdk(true);
  G.track("level_complete", { level: 3 });
  G.track("ad_rewarded");
  G.track("tên sai");
  assert.equal(warns.length, 1);
  assert.equal(sent.filter((m) => m.type === "TRACK").length, 0); // chưa gửi (chờ 5 giây)
  assert.deepEqual({ ...(await G.flush()) }, { sent: 2 });
  const msg = sent.find((m) => m.type === "TRACK")!;
  assert.deepEqual(JSON.parse(JSON.stringify(msg.payload.events)), [
    { name: "level_complete", props: { level: 3 } },
    { name: "ad_rewarded" },
  ]);
});

test("INIT không có ads (hub cũ) → SDK điền { rewarded: false, interstitial: false }", async () => {
  const { G, hub } = loadSdk(true);
  const p = G.init();
  hub("INIT", { protocolVersion: 1, standalone: false, locale: "vi", player: null, canSubmitScore: false });
  assert.deepEqual(JSON.parse(JSON.stringify((await p).ads)), { rewarded: false, interstitial: false });
});

test("share(): trong hub gửi SHARE (kèm điểm) và chờ SHARE_RESULT; invite() gửi INVITE", async () => {
  const { G, sent, hub } = loadSdk(true);
  const p = G.init();
  hub("INIT", { protocolVersion: 1, standalone: false, locale: "vi", player: null, canSubmitScore: true, social: { share: true, invite: true }, invites: { count: 2, viaGame: 1, invitedBy: null } });
  const data = await p;
  assert.equal(data.invites.count, 2);

  const shared = G.share({ score: 1234.7, text: "  Khoe nè  " });
  const msg = sent.find((m) => m.type === "SHARE")!;
  assert.equal(msg.payload.score, 1234);
  assert.equal(msg.payload.text, "Khoe nè");
  hub("SHARE_RESULT", { requestId: msg.payload.requestId, shared: true, method: "copy" });
  assert.deepEqual(JSON.parse(JSON.stringify(await shared)), { shared: true, method: "copy" });

  const invited = G.invite();
  const inv = sent.find((m) => m.type === "INVITE")!;
  assert.equal(inv.payload.score, undefined);
  hub("SHARE_RESULT", { requestId: inv.payload.requestId, shared: false, method: null });
  assert.equal((await invited).shared, false);
});

test("share(): hub cũ (INIT không có social) → UNSUPPORTED, không gửi gì", async () => {
  const { G, sent, hub } = loadSdk(true);
  const p = G.init();
  hub("INIT", { protocolVersion: 1, standalone: false, locale: "vi", player: null, canSubmitScore: false });
  const data = await p;
  assert.deepEqual(JSON.parse(JSON.stringify(data.social)), { share: false, invite: false });
  assert.equal(data.invites, null);
  assert.equal((await G.share()).reason, "UNSUPPORTED");
  assert.equal(sent.filter((m) => m.type === "SHARE").length, 0);
});

test("share(): ngoài hub dùng bảng chia sẻ của máy, không có thì copy link trang", async () => {
  const calls: unknown[] = [];
  const native = loadSdk(false, { share: async (d: unknown) => void calls.push(d) });
  assert.deepEqual(JSON.parse(JSON.stringify(await native.G.share({ text: "Chơi đi" }))), { shared: true, method: "native" });
  assert.equal((calls[0] as { url: string }).url, "https://mygame.example/play");

  let copied = "";
  const clip = loadSdk(false, { clipboard: { writeText: async (t: string) => void (copied = t) } });
  assert.equal((await clip.G.invite({ text: "Vào chơi" })).method, "copy");
  assert.equal(copied, "Vào chơi https://mygame.example/play");

  const none = loadSdk(false);
  assert.equal((await none.G.share()).reason, "UNSUPPORTED");
  assert.deepEqual(JSON.parse(JSON.stringify((await none.G.init()).social)), { share: false, invite: false });
});
