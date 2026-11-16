import { expect, test, type Page } from "@playwright/test";
import { installWallet, login } from "./wallet";

/**
 * Vòng đời tài khoản:
 * - đang chơi khách bấm "Đăng nhập ví": ví mới → gắn vào tài khoản khách (giữ điểm);
 *   ví đã có tài khoản → gộp điểm của tài khoản khách sang, tài khoản khách biến mất
 * - người chơi tự xóa tài khoản trên trang hồ sơ → điểm biến khỏi bảng xếp hạng
 * - admin không tự xóa được; cron hằng ngày (gửi lại webhook + dọn dữ liệu) cần CRON_SECRET
 */
const HUB = "http://localhost:3000";
const GAME_ORIGIN = "http://127.0.0.1:3000";

async function hubApi<T = unknown>(page: Page, path: string, method = "GET", body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const res = await fetch(`/api/v1${path}`, {
        method,
        headers: body === undefined ? {} : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, data: (await res.json().catch(() => null)) as unknown };
    },
    { path, method, body },
  ) as Promise<{ status: number; data: T }>;
}

async function playRound(game: Page, taps: number) {
  await game.getByRole("button", { name: "Bắt đầu" }).click();
  for (let i = 0; i < taps; i++) await game.getByRole("button", { name: "BẤM!" }).click();
  await expect(game.getByTestId("result")).toContainText(`Đã lưu ${taps} điểm`, { timeout: 20_000 });
}

test("Tài khoản khách → gắn / gộp vào ví; tự xóa tài khoản; admin không tự xóa; cron hằng ngày", async ({ page, browser, request }) => {
  test.setTimeout(150_000);

  // ── Admin chuẩn bị game + key ──
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  const studio = await hubApi<{ studio: { id: string } | null }>(page, "/developer/studio");
  if (!studio.data.studio) {
    expect((await hubApi(page, "/developer/studio", "POST", { name: "E2E Studio", slug: "e2e-studio", acceptTerms: true })).status).toBe(201);
  }
  const created = await hubApi<{ game: { id: string } }>(page, "/developer/games", "POST", {
    slug: "e2e-link",
    translations: [{ locale: "vi", name: "E2E Link" }],
  });
  let gameId = created.data?.game?.id;
  if (created.status === 409) {
    const list = await hubApi<{ games: { id: string; slug: string }[] }>(page, "/developer/games");
    gameId = list.data.games.find((g) => g.slug === "e2e-link")!.id;
  }
  expect((await hubApi(page, `/developer/games/${gameId}`, "PATCH", { allowedOrigins: [GAME_ORIGIN] })).status).toBe(200);
  const pk = await hubApi<{ key: string }>(page, `/developer/games/${gameId}/keys`, "POST", { kind: "PUBLISHABLE" });
  expect(pk.status).toBe(201);

  // Admin không tự xóa được tài khoản
  const selfDelete = await hubApi<{ error: { code: string } }>(page, "/me", "DELETE", { confirm: "DELETE" });
  expect(selfDelete.data.error.code).toBe("ADMIN_ACCOUNT");

  // ── Người chơi: khách → gắn ví mới (giữ điểm) ──
  const ctx = await browser.newContext({ locale: "vi-VN" });
  const game = await ctx.newPage();
  await installWallet(game, "third");
  await game.goto(`${GAME_ORIGIN}/demo/index.html?key=${pk.data.key}&api=${encodeURIComponent(HUB)}`);
  await expect(game.getByTestId("status")).toHaveText("Đã kết nối project: E2E Link");
  const board = game.getByTestId("board");

  await game.getByRole("button", { name: "Chơi khách" }).click();
  await expect(game.getByTestId("player")).toContainText("(khách)");
  await playRound(game, 3);

  await game.getByRole("button", { name: "Đăng nhập ví" }).click();
  await expect(game.getByTestId("player")).not.toContainText("khách", { timeout: 15_000 });
  const walletName = (await game.getByTestId("player").textContent())!.trim();
  await game.reload();
  await expect(board).toContainText(`${walletName} – 3`); // điểm khách nay mang tên ví
  await expect(board).not.toContainText("Player-");

  // ── Khách lần 2 → đăng nhập ví đã có tài khoản → gộp ──
  await game.getByRole("button", { name: "Đăng xuất" }).click();
  await game.getByRole("button", { name: "Chơi khách" }).click();
  await expect(game.getByTestId("player")).toContainText("(khách)");
  await playRound(game, 4);
  await expect(board).toContainText("Player-");
  await game.getByRole("button", { name: "Đăng nhập ví" }).click();
  await expect(game.getByTestId("player")).toHaveText(walletName, { timeout: 15_000 });
  await game.reload();
  await expect(board).toContainText(`${walletName} – 4`); // điểm cao nhất sau khi gộp
  await expect(board).not.toContainText("Player-"); // tài khoản khách đã bị gộp, không còn trên bảng

  // ── Người chơi tự xóa tài khoản trên Game Hub ──
  await game.goto(`${HUB}/`);
  await login(game, "third");
  await game.goto(`${HUB}/profile`);
  await game.getByRole("button", { name: "Xóa tài khoản…" }).click();
  const confirmBtn = game.getByRole("button", { name: "Xóa vĩnh viễn" });
  await expect(confirmBtn).toBeDisabled();
  await game.getByLabel("Gõ XOA để xác nhận").fill("xoa");
  await confirmBtn.click();
  await game.waitForURL(`${HUB}/`);
  await expect(game.locator("header").getByRole("button", { name: "Kết nối ví" })).toBeVisible();
  expect((await game.evaluate(async () => (await fetch("/api/v1/me")).status))).toBe(401);

  // Điểm của tài khoản đã xóa biến khỏi bảng xếp hạng của game
  await game.goto(`${GAME_ORIGIN}/demo/index.html?key=${pk.data.key}&api=${encodeURIComponent(HUB)}`);
  await expect(game.getByTestId("status")).toHaveText("Đã kết nối project: E2E Link");
  await expect(board).not.toContainText(walletName);
  await ctx.close();

  // ── Cron hằng ngày ──
  expect((await request.get("/api/cron/daily")).status()).toBe(401);
  const cron = await request.get("/api/cron/daily", { headers: { authorization: "Bearer e2e-cron-secret-0123456789" } });
  expect(cron.status()).toBe(200);
  expect(Object.keys(((await cron.json()) as { cleanup: object }).cleanup).sort()).toEqual(
    ["events", "guests", "monthlyPlayers", "reports", "webhookDeliveries"],
  );
});
