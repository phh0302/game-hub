import { expect, test } from "@playwright/test";
import { installWallet, login } from "./wallet";

/** Góp ý & liên hệ: khách gửi từ /contact → admin thấy trong trang Quản trị và đánh dấu đã xử lý */
test("góp ý: khách gửi form, admin xem + đánh dấu đã xử lý", async ({ page, request }) => {
  const marker = `E2E góp ý ${Date.now()}`;

  // Link liên hệ ở cuối trang
  await page.goto("/");
  await expect(page.locator("footer").getByRole("link", { name: "admin@monlabs.fun" })).toHaveAttribute("href", "mailto:admin@monlabs.fun");
  await page.locator("footer").getByRole("link", { name: "Góp ý & liên hệ" }).click();
  await expect(page).toHaveURL(/\/contact/);
  await expect(page.getByTestId("contact-email")).toHaveAttribute("href", "mailto:admin@monlabs.fun");

  // Nội dung quá ngắn → báo lỗi tại chỗ
  const form = page.getByTestId("feedback-form");
  await form.getByText("Báo lỗi").click();
  await form.locator("textarea[name=message]").fill("abc");
  await form.getByRole("button", { name: "Gửi góp ý" }).click();
  await expect(form.getByRole("status")).toContainText("ít nhất 5 ký tự");

  // Gửi thật
  await form.locator("textarea[name=message]").fill(`${marker}: nút chơi lại bị lệch trên điện thoại`);
  await form.locator("input[name=email]").fill("player@example.com");
  const sent = page.waitForResponse((r) => r.url().endsWith("/api/v1/feedback") && r.status() === 201);
  await form.getByRole("button", { name: "Gửi góp ý" }).click();
  await sent;
  await expect(page.getByTestId("feedback-done")).toBeVisible();

  // API: email sai → 400; bot điền ô ẩn → 201 nhưng không lưu
  const bad = await request.post("/api/v1/feedback", { data: { category: "IDEA", message: "hello world", email: "not-an-email" } });
  expect(bad.status()).toBe(400);
  const bot = await request.post("/api/v1/feedback", { data: { category: "IDEA", message: `${marker} bot`, website: "http://spam" } });
  expect(bot.status()).toBe(201);
  expect(((await bot.json()) as { feedback: { id: string | null } }).feedback.id).toBeNull();

  // Khách không xem được danh sách
  expect((await request.get("/api/v1/admin/feedback")).status()).toBe(401);

  // Admin thấy góp ý (loại, nội dung, email trả lời) và đánh dấu đã xử lý
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  await page.goto("/admin");
  const box = page.getByTestId("admin-feedback");
  const row = box.getByRole("listitem").filter({ hasText: marker });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Báo lỗi");
  await expect(row.getByRole("link", { name: /player@example.com/ })).toHaveAttribute("href", "mailto:player@example.com");
  await expect(box).not.toContainText(`${marker} bot`);
  await row.getByRole("button", { name: "Đã xử lý" }).click();
  await expect(box.getByRole("listitem").filter({ hasText: marker })).toHaveCount(0);
  await box.getByRole("tab", { name: /Đã xử lý/ }).click();
  await expect(box.getByRole("listitem").filter({ hasText: marker })).toBeVisible();
});
