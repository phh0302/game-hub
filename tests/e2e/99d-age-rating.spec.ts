import { expect, test } from "@playwright/test";
import { installWallet, login } from "./wallet";

/** Gắn cờ độ tuổi: nhãn trên thẻ / trang game, game 18+ phải xác nhận tuổi trước khi tải */
test("độ tuổi: nhãn 18+ và màn xác nhận tuổi", async ({ page, browser }) => {
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  const api = page.request;
  const { games } = (await (await api.get("/api/v1/admin/games")).json()) as {
    games: { id: string; slug: string; status: string; currentVersionId: string | null; ageRating: string }[];
  };
  const game = games.find((g) => g.status === "PUBLISHED" && g.currentVersionId && g.slug !== "memory")!;
  expect(game).toBeTruthy();

  const set = (ageRating: string) => api.patch(`/api/v1/admin/games/${game.id}`, { data: { ageRating } });
  expect((await set("NOPE")).status()).toBe(400);
  expect((await set("AGE_18")).ok()).toBe(true);
  try {
    // Khách (máy khác, chưa xác nhận)
    const ctx = await browser.newContext({ locale: "vi-VN" });
    const guest = await ctx.newPage();
    await guest.goto("/");
    await expect(guest.locator(`a[href="/games/${game.slug}"]`).getByTestId("age-badge")).toHaveText("18+");
    await guest.goto(`/games/${game.slug}`);
    await expect(guest.getByTestId("age-gate")).toBeVisible();
    await expect(guest.locator("iframe")).toHaveCount(0);
    await guest.getByRole("button", { name: "Tôi đủ 18 tuổi" }).click();
    await expect(guest.locator("iframe")).toHaveCount(1);
    // Đã xác nhận → lần sau không hỏi lại
    await guest.reload();
    await expect(guest.locator("iframe")).toHaveCount(1);
    await expect(guest.getByTestId("age-gate")).toHaveCount(0);
    await ctx.close();

    // 12+: chỉ có nhãn, không chặn
    expect((await set("AGE_12")).ok()).toBe(true);
    const ctx2 = await browser.newContext({ locale: "vi-VN" });
    const p2 = await ctx2.newPage();
    await p2.goto(`/games/${game.slug}`);
    await expect(p2.getByTestId("age-badge")).toHaveText("12+");
    await expect(p2.locator("iframe")).toHaveCount(1);
    await ctx2.close();
  } finally {
    await set("ALL");
  }
});
