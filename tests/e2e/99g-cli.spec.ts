import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installWallet, login } from "./wallet";

const CLI = path.resolve("packages/cli/bin/monlabs.mjs");

/** Token CLI + `monlabs deploy`: đẩy bản build từ terminal, token chỉ dùng được cho API Studio */
test("CLI: tạo token, deploy bản build, token bị giới hạn phạm vi, thu hồi có hiệu lực ngay", async ({ page, baseURL, request }) => {
  test.setTimeout(90_000);
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  const api = page.request;
  if (!((await (await api.get("/api/v1/developer/studio")).json()) as { studio: unknown }).studio) {
    await api.post("/api/v1/developer/studio", { data: { name: "E2E Studio", slug: "e2e-studio", acceptTerms: true } });
  }
  const slug = `e2e-cli-${Date.now().toString(36)}`;
  const created = await api.post("/api/v1/developer/games", { data: { slug, translations: [{ locale: "vi", name: "CLI test" }] } });
  const gameId = ((await created.json()) as { game: { id: string } }).game.id;

  const res = await api.post("/api/v1/developer/tokens", { data: { name: "e2e", expiresInDays: 30 } });
  expect(res.status()).toBe(201);
  const { token } = (await res.json()) as { token: { token: string; id: string; prefix: string } };
  expect(token.token).toMatch(/^mlb_/);
  const bearer = { authorization: `Bearer ${token.token}` };

  // Phạm vi: không quản lý token, không gọi API ngoài Studio
  expect((await request.get("/api/v1/developer/tokens", { headers: bearer })).status()).toBe(403);
  expect((await request.get("/api/v1/me", { headers: bearer })).status()).toBe(401);
  expect((await request.get("/api/v1/admin/games", { headers: bearer })).status()).toBe(401);
  expect((await request.get("/api/v1/developer/games", { headers: bearer })).status()).toBe(200);
  expect((await request.get("/api/v1/developer/games", { headers: { authorization: "Bearer mlb_" + "x".repeat(40) } })).status()).toBe(401);

  // Thư mục build tạm (có .env và node_modules – CLI phải bỏ qua)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mlb-build-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><canvas></canvas><script src='game.js'></script>");
  fs.writeFileSync(path.join(dir, "game.js"), "let score = 0;");
  fs.writeFileSync(path.join(dir, ".env"), "SECRET_KEY=sk_live_should_not_upload");
  fs.mkdirSync(path.join(dir, "node_modules/x"), { recursive: true });
  fs.writeFileSync(path.join(dir, "node_modules/x/i.js"), "x");

  const home = fs.mkdtempSync(path.join(os.tmpdir(), "mlb-home-"));
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [CLI, ...args, "--hub", baseURL!], {
      env: { ...process.env, HOME: home, USERPROFILE: home, MONLABS_TOKEN: token.token, NO_COLOR: "1" },
      encoding: "utf8",
      timeout: 60_000,
    });

  const games = run("games");
  expect(games.status, games.stderr).toBe(0);
  expect(games.stdout).toContain(slug);

  const dep = run("deploy", dir, "--game", slug, "--version", "1.0.0", "--notes", "từ CLI");
  expect(dep.status, dep.stderr + dep.stdout).toBe(0);
  expect(dep.stdout).toContain(`${slug} v1.0.0`);
  expect(dep.stdout).toContain("2 file");
  expect(dep.stdout + dep.stderr).not.toContain(token.token); // không in token

  const game = ((await (await api.get(`/api/v1/developer/games/${gameId}`)).json()) as {
    game: { versions: { version: string; status: string; releaseNotes: string | null; scanLevel: string }[] };
  }).game;
  expect(game.versions[0]).toMatchObject({ version: "1.0.0", status: "PENDING_REVIEW", releaseNotes: "từ CLI", scanLevel: "clean" });

  // Thiếu index.html → báo lỗi, mã thoát khác 0
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "mlb-empty-"));
  const bad = run("deploy", empty, "--game", slug, "--version", "1.0.1");
  expect(bad.status).not.toBe(0);
  expect(bad.stderr).toContain("index.html");

  // Studio hiện token (chỉ phần đầu)
  await page.goto("/developer");
  await expect(page.getByText(`${token.prefix}…`)).toBeVisible();

  // Thu hồi → dùng lại bị từ chối ngay
  expect((await api.delete(`/api/v1/developer/tokens/${token.id}`)).ok()).toBe(true);
  const after = run("games");
  expect(after.status).toBe(1);
  expect(after.stderr).toContain("thu hồi");
});
