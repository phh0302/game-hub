import { expect, test } from "@playwright/test";

test("trang chủ hiện đủ 4 game mẫu", async ({ page }) => {
  await page.goto("/");
  for (const name of ["2048", "Rắn săn mồi", "Neon Flap", "Lật thẻ"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
});

test("health, sitemap, robots", async ({ request }) => {
  const health = await (await request.get("/api/v1/health")).json();
  expect(health).toMatchObject({ status: "ok", db: "ok" });

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/games/memory");
  expect(sitemap).toContain("/games/2048/leaderboard");

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toContain("Sitemap:");
});

test("link khoe điểm có ảnh xem trước PNG", async ({ page, request }) => {
  await page.goto("/games/2048?score=1696");
  const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(ogImage).toContain("/api/og?");
  expect(ogImage).toContain("score=1696");

  const res = await request.get("/api/og?game=2048&score=1696");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
});

test("game bị ép chạy trong sandbox (không đọc được cookie của hub)", async ({ page }) => {
  await page.goto("/uploads/games/2048/1.0.0/index.html");
  const result = await page.evaluate(() => {
    try {
      return document.cookie;
    } catch (e) {
      return (e as Error).name;
    }
  });
  expect(result).toBe("SecurityError");
});

test("khách chưa kết nối ví vẫn chơi được và được đếm lượt chơi", async ({ page }) => {
  await page.goto("/games/snake");
  const play = page.waitForResponse((r) => r.url().endsWith("/api/v1/games/snake/plays") && r.status() === 201);
  const game = page.frameLocator('iframe[title="Rắn săn mồi"]');
  await game.locator("#play").click();
  await play;
});

test("PWA: manifest + service worker + trang offline", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ short_name: "Game Hub", display: "standalone" });
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  expect((await request.get("/icons/icon-512.png")).headers()["content-type"]).toContain("image/png");

  await page.goto("/");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe("http://localhost:3000/");
  expect(await (await request.get("/offline.html")).text()).toContain("Mất kết nối");
});
