import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// @ts-expect-error – file .mjs không có kiểu
import { buildModule } from "../../packages/sdk/build.mjs";
// @ts-expect-error – file .mjs không có kiểu
import { collectFiles, parseArgs } from "../../packages/cli/bin/monlabs.mjs";

const sdkSource = fs.readFileSync(new URL("../../public/sdk/gamehub-sdk.js", import.meta.url), "utf8");

async function loadModule(win: Record<string, unknown> | undefined) {
  const g = globalThis as Record<string, unknown>;
  const prev = g.window;
  if (win) g.window = win;
  else delete g.window;
  try {
    const code = buildModule(sdkSource);
    return { mod: await import(`data:text/javascript;base64,${Buffer.from(code + `\n// ${Math.random()}`).toString("base64")}`), restore: () => (g.window = prev) };
  } catch (e) {
    g.window = prev;
    throw e;
  }
}

test("@monlabs/sdk: import an toàn khi SSR, dùng trên trình duyệt ra đúng SDK", async () => {
  const ssr = await loadModule(undefined);
  assert.throws(() => ssr.mod.GameHub.init, /chỉ chạy trên trình duyệt/);
  ssr.restore();

  const win: Record<string, unknown> = { navigator: { language: "vi" }, addEventListener: () => {} };
  win.parent = win; // không nằm trong khung → chế độ chạy riêng
  const { mod, restore } = await loadModule(win);
  try {
    assert.equal(mod.default, mod.GameHub);
    assert.equal(mod.GameHub.version, 3);
    for (const fn of ["init", "gameStart", "gameOver", "saveState", "loadState", "track", "share", "invite", "showRewardedAd", "on"]) {
      assert.equal(typeof mod.GameHub[fn], "function", fn);
    }
    const data = await mod.GameHub.init();
    assert.equal(data.standalone, true);
    assert.ok(win.GameHub, "gắn window.GameHub để code cũ vẫn chạy");
  } finally {
    restore();
  }
});

test("@monlabs/sdk: kiểu TypeScript có đủ hàm của SDK", () => {
  const dts = fs.readFileSync(new URL("../../packages/sdk/src/index.d.ts", import.meta.url), "utf8");
  const fns = [...sdkSource.matchAll(/^ {4}([a-zA-Z]+): function/gm)].map((m) => m[1]);
  assert.ok(fns.length > 15);
  for (const fn of fns) assert.match(dts, new RegExp(`\\b${fn}[<(]`), `thiếu kiểu cho ${fn}()`);
});

test("@monlabs/cli: đọc tham số, gom file build bỏ node_modules / .env / .map", () => {
  assert.deepEqual(parseArgs(["deploy", "./dist", "--game", "snake", "--version=1.2.0", "--dry-run"]), {
    _: ["deploy", "./dist"],
    game: "snake",
    version: "1.2.0",
    "dry-run": true,
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mlb-"));
  for (const [p, body] of Object.entries({
    "index.html": "<p>hi</p>",
    "assets/app.js": "1",
    "assets/app.js.map": "{}",
    ".env": "SECRET=1",
    ".env.local": "SECRET=2",
    "node_modules/x/index.js": "x",
    ".git/HEAD": "ref",
  })) {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), body);
  }
  const { files, count } = collectFiles(dir);
  assert.deepEqual(Object.keys(files).sort(), ["assets/app.js", "index.html"]);
  assert.equal(count, 2);
});
