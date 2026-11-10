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
