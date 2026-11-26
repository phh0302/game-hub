import { expect, test } from "@playwright/test";

/** Sandbox: thử game theo địa chỉ bất kỳ với hub giả lập (không cần đăng nhập, không lưu lên máy chủ) */
test("sandbox: hub giả lập đủ SDK cho game chạy từ địa chỉ ngoài", async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  const gameUrl = `${baseURL}/uploads/games/save-demo/1.0.0/index.html`;
  await page.goto(`/developer/sandbox?url=${encodeURIComponent(gameUrl)}`);
  const checklist = page.getByTestId("sandbox-checklist");
  const log = page.getByTestId("sandbox-log");
  await expect(checklist.locator("li", { hasText: "READY" })).toHaveAttribute("data-ok", "1");
  await expect(checklist.locator("li", { hasText: "STATE_LOAD" })).toHaveAttribute("data-ok", "1");

  const game = page.frameLocator("iframe");
  await expect(game.getByTestId("log")).toContainText("init: standalone=false canSubmitScore=true");
  await game.locator("#jar").click();
  await game.locator("#jar").click();
  await expect(checklist.locator("li", { hasText: "GAME_OVER" })).toHaveAttribute("data-ok", "1", { timeout: 20_000 });
  await expect(log).toContainText("Sandbox: lưu 2 điểm");
  await expect(checklist.locator("li", { hasText: "STATE_SAVE" })).toHaveAttribute("data-ok", "1");
  await expect(game.getByTestId("log")).toContainText("scoreResult");

  // Chia sẻ trong game → bảng chia sẻ của sandbox → game nhận SHARE_RESULT
  await game.locator("#share").click();
  await expect(page.getByTestId("share-sheet")).toBeVisible();
  await page.getByTestId("share-sheet").getByRole("button", { name: "Đóng" }).click();
  await expect(log).toContainText("SHARE_RESULT");
  await expect(game.getByTestId("log")).toContainText('share: {"shared":false');

  // Đăng xuất giả lập → INIT gửi lại, game thấy canSubmitScore=false
  await page.getByLabel("Đã đăng nhập").uncheck();
  await expect(game.getByTestId("log")).toContainText("canSubmitScore=false");

  // Địa chỉ sai
  await page.getByTestId("sandbox-url").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Mở" }).click();
  await expect(log).toContainText("Địa chỉ không hợp lệ");
});
