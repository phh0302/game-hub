import { expect, test } from "@playwright/test";
import { installWallet, login } from "./wallet";

/**
 * GameHub.saveState / loadState trên hub thật: game chạy trong iframe sandbox (origin "null") nên
 * localStorage của game bị chặn; hub lưu hộ → tải lại trang vẫn còn tiến trình. Chơi thử dùng ô riêng.
 */
test("saveState: tiến trình còn sau khi tải lại; localStorage của game bị chặn; Chơi thử không đè", async ({ page, browser }) => {
  test.setTimeout(90_000);

  // Admin đưa game mẫu Star Jar lên (bản build có sẵn trong public/uploads/games/save-demo)
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  const ids = await page.evaluate(async () => {
    const call = (url: string, method: string, body?: unknown) =>
      fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) =>
        r.json(),
      );
    const list = (await call("/api/v1/admin/games", "GET")).games as { id: string; slug: string; currentVersionId: string | null }[];
    let game = list.find((g) => g.slug === "e2e-star-jar");
    if (!game) {
      game = (await call("/api/v1/admin/games", "POST", {
        slug: "e2e-star-jar",
        status: "PENDING_REVIEW",
        translations: [{ locale: "vi", name: "E2E Star Jar" }],
      })).game;
    }
    const v = (await call(`/api/v1/admin/games/${game!.id}/versions`, "POST", { version: `1.0.${Date.now() % 100000}`, storageKey: "games/save-demo/1.0.0" })).version;
    await call(`/api/v1/admin/games/${game!.id}/versions/${v.id}`, "PATCH", { status: "APPROVED" });
    await call(`/api/v1/admin/games/${game!.id}/versions/${v.id}/activate`, "POST");
    return { versionId: v.id as string };
  });

  // Người chơi (khách) chơi 1 ván 10 giây
  const ctx = await browser.newContext({ locale: "vi-VN" });
  const p = await ctx.newPage();
  await p.goto("/games/e2e-star-jar");
  const game = p.frameLocator('iframe[title="E2E Star Jar"]');
  const log = game.getByTestId("log");
  await expect(log).toContainText("localStorage: blocked");
  await expect(log).toContainText("loadState: null");
  for (let i = 0; i < 5; i++) await game.getByRole("button", { name: "jar" }).click();
  await expect(log).toContainText('saveState: {"saved":true,"code":null}', { timeout: 15_000 });
  await expect(game.locator("#total")).toHaveText("5");

  // Tải lại trang → tiến trình đọc lại từ hub
  await p.reload();
  await expect(game.getByTestId("log")).toContainText('loadState: {"total":5,"runs":1}');
  await expect(game.locator("#total")).toHaveText("5");

  // Trang Chơi thử của admin dùng ô riêng → không thấy tiến trình thật
  await page.goto(`/preview/${ids.versionId}`);
  const preview = page.frameLocator("iframe");
  await expect(preview.getByTestId("log")).toContainText("loadState: null");
  await expect(page.getByText("← STATE_LOAD")).toBeVisible();

  await ctx.close();
});
