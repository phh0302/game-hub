import { expect, test } from "@playwright/test";

/**
 * Quảng cáo Google H5 Games Ads: CI không đặt NEXT_PUBLIC_ADSENSE_CLIENT → hub tắt quảng cáo
 * (init.ads = false, xem 94-save-state); ở đây kiểm các phần phía máy chủ và trang công khai.
 */
const ip = () => `203.0.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;

test("ads.txt: chưa cấu hình AdSense → không khai báo tài khoản", async ({ request }) => {
  const r = await request.get("/ads.txt");
  expect(r.ok()).toBe(true);
  expect(r.headers()["content-type"]).toContain("text/plain");
  expect(await r.text()).not.toContain("google.com");
});

test("ghi nhận lượt quảng cáo: kiểm dữ liệu, game không tồn tại → 404", async ({ request }) => {
  const headers = { "x-forwarded-for": ip() };
  const good = await request.post("/api/v1/games/2048/ads", { headers, data: { kind: "rewarded", status: "viewed" } });
  expect(good.ok()).toBe(true);
  for (const data of [{ kind: "banner", status: "viewed" }, { kind: "rewarded", status: "paid" }, {}]) {
    expect((await request.post("/api/v1/games/2048/ads", { headers, data })).status()).toBe(400);
  }
  expect((await request.post("/api/v1/games/khong-co-game-nay/ads", { headers, data: { kind: "interstitial", status: "nofill" } })).status()).toBe(404);
});

test("game không tự gửi được sự kiện hub.ad.* qua GameHub.track", async ({ request }) => {
  const r = await request.post("/api/v1/games/2048/events", {
    headers: { "x-forwarded-for": ip() },
    data: { events: [{ name: "hub.ad.rewarded.viewed" }, { name: "level_up" }] },
  });
  expect(r.ok()).toBe(true);
  const body = (await r.json()) as { accepted?: number; dropped?: number; reason?: string };
  // Kho Redis có trong CI → nhận 1 (level_up); tên hub.* bị lọc trước khi đếm
  if (!body.reason) expect(body.accepted).toBe(1);
});

test("trang quyền riêng tư có mục quảng cáo Google, link ở chân trang", async ({ page }) => {
  await page.goto("/");
  await page.locator("footer").getByRole("link", { name: /Quyền riêng tư|Privacy/ }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Chính sách quyền riêng tư|Privacy policy/);
  await expect(page.getByText(/adssettings\.google\.com/)).toBeVisible();
});
