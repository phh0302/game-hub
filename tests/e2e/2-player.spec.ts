import { expect, test } from "@playwright/test";
import { installWallet, login } from "./wallet";

// 1x1 PNG hợp lệ – đủ để thử upload ảnh đại diện
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await installWallet(page, "player");
});

test("đăng nhập ví → chơi Lật thẻ → lưu thời gian lên bảng xếp hạng", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/games/memory");
  await login(page, "player");

  const frame = page.frameLocator('iframe[title="Lật thẻ"]');
  await expect(frame.locator(".card")).toHaveCount(16);
  const symbols = await frame.locator(".card .front").allTextContents();
  const pairs = new Map<string, number[]>();
  symbols.forEach((s, i) => pairs.set(s, [...(pairs.get(s) ?? []), i]));

  // Lật thẻ đầu → hub mở lượt chơi; chờ quá thời gian tối thiểu (5 giây) rồi mới giải hết
  const session = page.waitForResponse((r) => r.url().endsWith("/api/v1/games/memory/sessions") && r.ok());
  const [first] = pairs.values();
  await frame.locator(`.card[data-index="${first[0]}"]`).click();
  await session;
  await page.waitForTimeout(6_000);
  await frame.locator(`.card[data-index="${first[1]}"]`).click();
  for (const [a, b] of [...pairs.values()].slice(1)) {
    await frame.locator(`.card[data-index="${a}"]`).click();
    await frame.locator(`.card[data-index="${b}"]`).click();
  }

  await expect(page.getByRole("status").filter({ hasText: "Kỷ lục mới" })).toBeVisible();
  // Bảng xếp hạng thời gian hiện dạng 0:06,x thay vì số điểm
  await expect(page.getByRole("region", { name: "Bảng xếp hạng" })).toContainText(/0:0\d,\d/);
  await expect(page.getByRole("button", { name: /Khoe điểm/ })).toBeVisible();
});

test("hồ sơ: đặt tên + tải ảnh đại diện", async ({ page }) => {
  await page.goto("/");
  await login(page, "player");
  await page.goto("/profile");

  await page.locator('input[type="file"]').setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Đổi ảnh")).toBeVisible();
  await page.getByPlaceholder("ha_pham").fill("e2e_player");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByText("Đã lưu!")).toBeVisible();

  const me = await (await page.request.get("/api/v1/me")).json();
  expect(me.user.username).toBe("e2e_player");
  expect(me.user.avatarUrl).toMatch(/\/uploads\/u\/images\/.+\.(webp|png)$/);
});

test("đăng xuất mọi thiết bị thu hồi phiên ngay", async ({ page }) => {
  await page.goto("/");
  await login(page, "player");
  await page.goto("/profile");
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Đăng xuất mọi thiết bị" }).click();
  await expect(page.locator("header").getByRole("button", { name: "Kết nối ví" })).toBeVisible();
  expect((await page.request.get("/api/v1/me")).status()).toBe(401);
});
