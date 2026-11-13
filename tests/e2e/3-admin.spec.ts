import { expect, test } from "@playwright/test";
import { installWallet, login, WALLETS } from "./wallet";

test("người chơi thường không vào được trang quản trị", async ({ page }) => {
  await installWallet(page, "player");
  await page.goto("/");
  await login(page, "player");
  await page.goto("/admin");
  await expect(page).toHaveURL(/auth=forbidden/);
});

test("admin: xem thống kê, khóa rồi mở khóa người chơi", async ({ page }) => {
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  await page.goto("/admin");

  const stats = page.locator("section", { has: page.getByRole("heading", { name: "Thống kê" }) }).last();
  await expect(stats.getByText("Lượt chơi mỗi ngày")).toBeVisible();
  await expect(stats.getByRole("cell", { name: "Lật thẻ" })).toBeVisible();

  const users = page.locator("section", { has: page.getByRole("heading", { name: "Người dùng" }) }).last();
  await users.getByPlaceholder(/Địa chỉ ví/).fill(WALLETS.player.address);
  await users.getByRole("button", { name: "Tìm" }).click();
  await expect(users.getByText("e2e_player")).toBeVisible();

  page.once("dialog", (d) => void d.accept("e2e test"));
  await users.getByRole("button", { name: "Khóa tài khoản" }).click();
  await expect(users.getByText("Đã khóa", { exact: true })).toBeVisible();

  await users.getByRole("button", { name: "Mở khóa" }).click();
  await expect(users.getByText("Đã khóa", { exact: true })).toHaveCount(0);
});

test("admin tạo giải đấu ăn theo bảng chính → điểm người chơi tự vào giải", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  await page.goto("/admin");

  const boards = page.locator("section", { has: page.getByRole("heading", { name: "Bảng xếp hạng & giải đấu" }) }).last();
  await boards.getByLabel("Chọn game").selectOption({ label: "Lật thẻ (memory)" });
  await expect(boards.getByText("Bảng chính")).toBeVisible();
  await boards.getByRole("button", { name: "+ Tạo bảng / giải" }).click();
  // Tên riêng mỗi lần chạy (lần chạy lại của CI không đụng giải của lần trước)
  const n = Date.now() % 100_000;
  const name = `Giải e2e ${n}`;
  const key = `giai-e2e-${n}`;
  await boards.getByLabel("Tên (tiếng Việt)").fill(name);
  await expect(boards.getByLabel("Mã bảng")).toHaveValue(key);
  // Bắt đầu ngay để nhận điểm luôn
  await boards.getByLabel("Bắt đầu").fill("2020-01-01T00:00");
  await boards.getByRole("button", { name: "Tạo bảng / giải", exact: true }).click();
  await expect(boards.getByText("Đã tạo bảng xếp hạng.")).toBeVisible();
  const row = boards.getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText(`${key} ← default`);
  await expect(row).toContainText("Đang mở");

  // Người chơi nộp điểm vào bảng chính → tự có mặt trong giải
  const ctx = await browser.newContext({ locale: "vi-VN" });
  const player = await ctx.newPage();
  await installWallet(player, "player");
  await player.goto("/games/memory");
  await login(player, "player");
  const result = await player.evaluate(async () => {
    const post = (url: string, body: unknown) =>
      fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    const { sessionId } = await post("/api/v1/games/memory/sessions", {});
    await new Promise((r) => setTimeout(r, 4_000));
    return post("/api/v1/games/memory/scores", { sessionId, score: 5_000 });
  });
  expect(result.tournaments).toContainEqual({ key, rank: 1 });

  const list = await (await player.request.get("/api/v1/games/memory/leaderboards")).json();
  const keys = list.leaderboards.map((b: { key: string }) => b.key);
  expect(keys[0]).toBe("default");
  expect(keys).toContain(key);
  const top = await (await player.request.get(`/api/v1/games/memory/leaderboard?board=${key}`)).json();
  expect(top.entries[0].displayName).toBe("e2e_player");

  // Trang game có nút chuyển sang bảng giải
  await player.reload();
  await player.getByRole("tab", { name }).click();
  await expect(player.getByRole("region", { name: "Bảng xếp hạng" })).toContainText("e2e_player");
  await ctx.close();

  await page.reload();
  await boards.getByLabel("Chọn game").selectOption({ label: "Lật thẻ (memory)" });
  await expect(row).toContainText("1 (1)");
  page.once("dialog", (d) => void d.accept());
  await row.getByRole("button", { name: "Xóa" }).click();
  await expect(boards.getByText("Đã xóa bảng.")).toBeVisible();
  await expect(row).toHaveCount(0);
});

test("admin: sửa luật của game rồi lưu trữ game ngay trên trang", async ({ page }) => {
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  await page.goto("/admin");

  // Game tạm để lưu trữ (tạo qua API cho nhanh)
  const created = await page.evaluate(async () => {
    const r = await fetch("/api/v1/admin/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "e2e-luu-tru", translations: [{ locale: "vi", name: "E2E lưu trữ" }] }),
    });
    return r.status;
  });
  expect([200, 201]).toContain(created);
  await page.reload();

  const card = page.locator("section", { has: page.getByRole("heading", { name: /E2E lưu trữ/ }) }).last();
  await card.getByLabel("Thời gian chơi tối thiểu (giây)").fill("12");
  await card.getByLabel("Lượt chơi dài tối đa (giờ)").fill("2");
  await card.getByRole("button", { name: "Lưu luật" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Đã lưu luật của game.");

  const settings = await page.evaluate(async () => {
    const g = (await (await fetch("/api/v1/admin/games")).json()).games.find((x: { slug: string }) => x.slug === "e2e-luu-tru");
    return g.settings;
  });
  expect(settings).toMatchObject({ minPlaySeconds: 12, maxSessionHours: 2 });

  await card.getByRole("button", { name: "Lưu trữ game" }).click();
  await card.getByRole("button", { name: "Xác nhận lưu trữ" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Đã lưu trữ game.");
  await expect(page.getByRole("heading", { name: /E2E lưu trữ/ })).toHaveCount(0);
  expect((await page.request.get("/games/e2e-luu-tru")).status()).toBe(404);
});
