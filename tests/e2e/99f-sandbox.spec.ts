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

  // Đăng xuất giả lập → INIT gửi lại với canSubmitScore=false
  await page.getByLabel("Đã đăng nhập").uncheck();
  await expect(log).toContainText('"player":null,"canSubmitScore":false');

  // Địa chỉ sai
  await page.getByTestId("sandbox-url").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Mở" }).click();
  await expect(log).toContainText("Địa chỉ không hợp lệ");
});

/** Phòng chơi giả lập: dev đóng vai người chơi ảo để thử GameHub.rooms trên máy (game mẫu Caro 3×3) */
test("sandbox: phòng chơi giả lập – tạo, người ảo vào, đi lượt, kết thúc; vào phòng qua link mời", async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  const gameUrl = `${baseURL}/uploads/games/rooms-demo/1.0.0/index.html`;
  await page.goto(`/developer/sandbox?url=${encodeURIComponent(gameUrl)}`);
  const game = page.frameLocator("iframe");
  const panel = page.getByTestId("sandbox-rooms");
  await expect(game.getByTestId("log")).toContainText("init rooms=true roomCode=null");

  // Game tạo phòng → bảng hiện mã; người chơi ảo vào; game (chủ phòng) bắt đầu
  await game.locator("#create").click();
  await expect(game.getByTestId("status")).toHaveText("Đang chờ (1/2)");
  const code = (await game.locator("#code").textContent())!.trim();
  await expect(panel.getByTestId("sandbox-room-code")).toHaveText(code);
  await panel.getByTestId("sandbox-bot-join").click();
  await expect(game.getByTestId("status")).toHaveText("Đang chờ (2/2)"); // ROOM_UPDATE tới game
  await game.locator("#start").click();
  await expect(game.getByTestId("status")).toHaveText("Tới lượt bạn");

  // X đi ô 0 → lượt người ảo; dev đi thay ô 4
  await game.locator('[data-cell="0"]').click();
  await expect(game.getByTestId("status")).toHaveText("Chờ đối thủ…");
  await panel.getByTestId("sandbox-bot-data").fill('{ "cell": 4 }');
  await panel.getByLabel(/Trạng thái mới/).fill('{ "board": [0,null,null,null,1,null,null,null,null] }');
  await panel.getByTestId("sandbox-bot-move").click();
  await expect(game.getByTestId("status")).toHaveText("Tới lượt bạn");
  await expect(game.locator('[data-cell="4"]')).toHaveText("O");

  // Hết lượt người ảo → ô nhập nước đi của người ảo ẩn
  await expect(panel.getByTestId("sandbox-bot-move")).toBeHidden();
  await game.locator('[data-cell="1"]').click();
  await panel.getByTestId("sandbox-bot-data").fill('{ "cell": 8 }');
  await panel.getByLabel(/Trạng thái mới/).fill('{ "board": [0,0,null,null,1,null,null,null,1] }');
  await panel.getByLabel("Kết thúc ván").check();
  await panel.getByLabel("Ghế thắng").fill("1");
  await panel.getByTestId("sandbox-bot-move").click();
  await expect(game.getByTestId("status")).toHaveText("Bạn thua!");
  await expect(page.getByTestId("sandbox-checklist").locator("li", { hasText: "ROOM" })).toHaveAttribute("data-ok", "1");

  // Người ảo làm chủ phòng → mở game như bạn bè bấm link mời → game tự vào phòng bằng init.roomCode
  await panel.getByRole("button", { name: "Xóa phòng" }).click();
  await panel.getByTestId("sandbox-bot-host").click();
  const botCode = (await panel.getByTestId("sandbox-room-code").textContent())!.trim();
  await panel.getByTestId("sandbox-open-invite").click();
  await expect(game.getByTestId("log")).toContainText(`joined ${botCode}`);
  await expect(game.getByTestId("status")).toHaveText("Đang chờ (2/2)");
});
