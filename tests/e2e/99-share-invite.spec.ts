import { expect, test } from "@playwright/test";
import { installWallet, login } from "./wallet";

/**
 * GameHub.share() / GameHub.invite() mở bảng chia sẻ của hub; link mời có ?ref=mã;
 * ví mới kết nối lần đầu qua link được tính cho người mời. Game mẫu Star Jar (e2e-star-jar, tạo ở 94-save-state).
 */
test("chia sẻ + mời bạn: bảng chia sẻ của hub, link mời ghi nhận ví mới", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await installWallet(page, "player");
  await page.goto("/");
  await login(page, "player");
  await page.goto("/games/e2e-star-jar");

  // Nút "Mời bạn" của hub → link riêng có ?ref=
  await page.getByRole("button", { name: /Mời bạn/ }).first().click();
  const sheet = page.getByTestId("share-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Mời bạn chơi cùng");
  const inviteLink = await sheet.locator("input").inputValue();
  expect(inviteLink).toMatch(/\/games\/e2e-star-jar\?ref=[a-z2-9]{8}$/);
  await sheet.getByRole("button", { name: "Đóng" }).click();
  await expect(sheet).toHaveCount(0);

  // Trong game: chơi 1 ván rồi GameHub.share({ score }) → bảng chia sẻ có điểm, đóng → game nhận SHARE_RESULT
  const game = page.frameLocator("iframe");
  await expect(game.locator("#share")).toBeVisible();
  await game.locator("#jar").click();
  await game.locator("#jar").click();
  await expect(game.getByTestId("log")).toContainText("scoreResult", { timeout: 20_000 });
  // Thông báo "đã lưu điểm" của hub nằm đè đáy khung game → đóng trước khi bấm nút trong game
  await page.getByRole("button", { name: "Đóng" }).click();
  await game.locator("#share").click();
  await expect(sheet).toContainText("Mình nhặt được 2 sao");
  expect(await sheet.locator("input").inputValue()).toMatch(/\?score=2&ref=/);
  await sheet.getByRole("button", { name: "Đóng" }).click();
  await expect(game.getByTestId("log")).toContainText('share: {"shared":false');
  await game.locator("#invite").click();
  await expect(sheet).toContainText("Mời bạn chơi cùng");
  await page.keyboard.press("Escape");
  await expect(game.getByTestId("log")).toContainText("invite: ");

  const before = (await (await page.request.get("/api/v1/me/invite")).json()) as { invited: number };

  // Ví mới mở link mời rồi kết nối ví → được tính cho người mời (1 lần)
  const ctx = await browser.newContext({ locale: "vi-VN" });
  const friend = await ctx.newPage();
  await installWallet(friend, "fresh");
  await friend.goto(inviteLink.replace(/^https?:\/\/[^/]+/, ""));
  await login(friend, "fresh");
  const mine = (await (await friend.request.get("/api/v1/me/invite")).json()) as { invitedBy: string | null };
  expect(mine.invitedBy).not.toBeNull();

  const after = (await (await page.request.get("/api/v1/me/invite?game=e2e-star-jar&list=1")).json()) as {
    invited: number;
    invitedViaGame: number;
    invitees: { game: string | null }[];
  };
  expect(after.invited).toBe(before.invited + 1);
  expect(after.invitedViaGame).toBeGreaterThanOrEqual(1);
  expect(after.invitees[0]?.game).toBe("e2e-star-jar");

  // Trang hồ sơ hiện link mời + số bạn đã mời
  await page.goto("/profile");
  await expect(page.getByTestId("invite-friends")).toContainText(`Đã mời ${after.invited} bạn`);
  await ctx.close();
});
