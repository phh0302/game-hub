import { expect, test, type Page } from "@playwright/test";
import { installWallet, login } from "./wallet";

/**
 * Platform API: game chạy trên domain khác (127.0.0.1) gọi Client API của hub (localhost).
 * 127.0.0.1:3000 và localhost:3000 là 2 origin khác nhau → kiểm tra được CORS + domain được phép.
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

test("Platform API: game ngoài hub đăng nhập khách / ví, nộp điểm, bảng xếp hạng; khóa bị thu hồi thì ngừng", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);

  // ── Developer (ví admin) tạo studio + game, khai báo domain, tạo key qua giao diện ──
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  const studio = await hubApi(page, "/developer/studio");
  if (studio.status !== 200 || !(studio.data as { studio: unknown }).studio) {
    const created = await hubApi(page, "/developer/studio", "POST", { name: "E2E Studio", slug: "e2e-studio", acceptTerms: true });
    expect(created.status).toBe(201);
  }
  const game = await hubApi<{ game: { id: string } }>(page, "/developer/games", "POST", {
    slug: "e2e-tap-rush",
    translations: [{ locale: "vi", name: "E2E Tap Rush" }],
  });
  let gameId = game.data?.game?.id;
  if (game.status === 409) {
    // Lần chạy lại (retry) – game đã tạo ở lần trước
    const list = await hubApi<{ games: { id: string; slug: string }[] }>(page, "/developer/games");
    gameId = list.data.games.find((g) => g.slug === "e2e-tap-rush")!.id;
  } else {
    expect(game.status).toBe(201);
  }

  await page.goto(`/developer/games/${gameId}`);
  await page.getByLabel("Domain được gọi API (mỗi dòng 1 domain)").fill(GAME_ORIGIN);
  await page.getByRole("button", { name: "Lưu domain" }).click();
  await expect(page.getByText("Đã lưu domain.")).toBeVisible();
  await page.getByRole("button", { name: "+ Tạo key" }).click();
  const key = (await page.getByTestId("new-api-key").textContent())!.trim();
  expect(key).toMatch(/^pk_live_[0-9A-Za-z]{32}$/);

  // ── Người chơi mở game trên domain khác ──
  const ctx = await browser.newContext({ locale: "vi-VN" });
  const game2 = await ctx.newPage();
  await installWallet(game2, "player");
  await game2.goto(`${GAME_ORIGIN}/demo/index.html?key=${key}&api=${encodeURIComponent(HUB)}`);
  await expect(game2.getByTestId("status")).toHaveText("Đã kết nối project: E2E Tap Rush");

  // Chơi khách
  await game2.getByRole("button", { name: "Chơi khách" }).click();
  await expect(game2.getByTestId("player")).toContainText("(khách)");
  await game2.getByRole("button", { name: "Bắt đầu" }).click();
  for (let i = 0; i < 5; i++) await game2.getByRole("button", { name: "BẤM!" }).click();
  await expect(game2.getByTestId("result")).toContainText("Đã lưu 5 điểm", { timeout: 20_000 });
  await expect(game2.getByTestId("board")).toContainText("– 5");

  // Đăng nhập ví (SIWE ghi domain của game)
  await game2.getByRole("button", { name: "Đăng xuất" }).click();
  await game2.getByRole("button", { name: "Đăng nhập ví" }).click();
  // Ghép cả dòng trạng thái để lỗi (nếu có) hiện ngay trong báo cáo test
  await expect
    .poll(async () => `${await game2.getByTestId("player").textContent()} | ${await game2.getByTestId("status").textContent()}`)
    .toContain("e2e_player |");
  await game2.getByRole("button", { name: "Bắt đầu" }).click();
  for (let i = 0; i < 7; i++) await game2.getByRole("button", { name: "BẤM!" }).click();
  await expect(game2.getByTestId("result")).toContainText("Đã lưu 7 điểm", { timeout: 20_000 });
  await expect(game2.getByTestId("board")).toContainText("e2e_player – 7");

  // ── Bảo mật ──
  const token = await game2.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("gamehub:")) return localStorage.getItem(k);
    }
    return null;
  });
  expect(token).toBeTruthy();
  const probe = (path: string, headers: Record<string, string>) =>
    game2.evaluate(
      async ({ url, headers }) => {
        const res = await fetch(url, { headers });
        return `${res.status} ${((await res.json()) as { error?: { code?: string } }).error?.code ?? "OK"}`;
      },
      { url: `${HUB}/api/p1${path}`, headers },
    );
  // Key sai
  expect(await probe("/project", { "x-gamehub-key": "pk_live_" + "x".repeat(32) })).toBe("401 INVALID_API_KEY");
  // Token người chơi chỉ dùng cho đúng project
  expect(await probe("/me", { "x-gamehub-key": key, authorization: `Bearer ${token}` })).toBe("200 OK");
  // Domain chưa khai báo (gọi từ chính hub) → bị chặn
  const fromHub = await page.evaluate(async (k) => {
    const res = await fetch("/api/p1/project", { headers: { "x-gamehub-key": k } });
    return `${res.status} ${((await res.json()) as { error?: { code?: string } }).error?.code ?? "OK"}`;
  }, key);
  expect(fromHub).toBe("403 ORIGIN_NOT_ALLOWED");
  // Token người chơi KHÔNG dùng được làm phiên đăng nhập hub
  const hubCtx = await browser.newContext();
  await hubCtx.addCookies([{ name: "gh_session", value: token!, url: HUB }]);
  expect((await hubCtx.request.get(`${HUB}/api/v1/me`)).status()).toBe(401);
  await hubCtx.close();

  // ── Thu hồi key → game ngừng gọi được API ──
  await page.reload();
  await page.getByRole("button", { name: "Thu hồi" }).click();
  await page.getByRole("button", { name: "Xác nhận thu hồi" }).click();
  await expect(page.getByText("Đã thu hồi key.")).toBeVisible();
  await game2.reload();
  await expect(game2.getByTestId("status")).toHaveText("Lỗi: INVALID_API_KEY");
  await ctx.close();
});
