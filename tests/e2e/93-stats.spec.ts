import { expect, test } from "@playwright/test";
import { installWallet } from "./wallet";

/**
 * Trang theo dõi lưu lượng (13b): stats.monlabs.fun → /stats, chỉ admin;
 * request được lấy mẫu (CI: TRAFFIC_SAMPLE_RATE=1) hiện trên biểu đồ; chặn IP → bất thường; cron gộp theo ngày.
 */
test("Trang stats: chỉ admin, có số liệu request, ghi bất thường khi chặn IP", async ({ page, request }) => {
  test.setTimeout(120_000);

  // ── Tên miền stats.* → trang /stats (chưa đăng nhập: chỉ thấy nút kết nối ví) ──
  const home = await request.get("/", { headers: { "x-forwarded-host": "stats.monlabs.fun" } });
  expect(home.status()).toBe(200);
  expect(await home.text()).toContain('data-testid="stats-gate"');

  // ── API số liệu chỉ cho admin ──
  expect((await request.get("/api/v1/admin/traffic/stats")).status()).toBe(401);

  // ── Tạo lưu lượng + 1 lần chặn IP (giả IP khác vì máy test được miễn chặn) ──
  for (let i = 0; i < 20; i++) await request.get("/api/v1/games");
  const ip = `198.51.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  // Cửa sổ đếm dồn dập là cửa sổ cố định 10 giây: gửi > 2 × giới hạn để dù rơi vào ranh giới 2 cửa sổ vẫn chắc chắn bị chặn
  const burst = await Promise.all(
    Array.from({ length: 320 }, () => request.get("/api/v1/health", { headers: { "x-forwarded-for": ip } })),
  );
  expect(burst.some((r) => r.status() === 429)).toBe(true);

  // ── Đăng nhập admin ngay trên trang stats ──
  await installWallet(page, "admin");
  await page.goto("/stats");
  const verified = page.waitForResponse((r) => r.url().endsWith("/api/v1/auth/verify") && r.ok());
  await page.getByTestId("stats-gate").getByRole("button", { name: "Kết nối ví" }).click();
  await verified;

  const dash = page.getByTestId("traffic-dashboard");
  await expect(dash).toBeVisible();
  await page.getByRole("tab", { name: "1 giờ" }).click();
  const kpis = page.getByTestId("traffic-kpis");
  await expect(kpis).toBeVisible();

  // Số liệu qua API (cùng cookie với trang)
  const res = await page.request.get("/api/v1/admin/traffic/stats?range=1h");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as {
    stats: {
      totals: { requests: number; blocked: number };
      routes: { name: string }[];
      slowRoutes: { name: string; avgMs: number; samples: number; errors: number }[];
      sampleRate: number;
    };
    anomalies: { type: string; message: string }[];
    telegram: { tokenSet: boolean };
  };
  expect(body.stats.sampleRate).toBe(1);
  expect(body.stats.totals.requests).toBeGreaterThanOrEqual(20);
  expect(body.stats.totals.blocked).toBeGreaterThan(0);
  expect(body.stats.routes.map((r) => r.name)).toContain("/api/v1/games");
  // Độ trễ theo route (các test trước đã gọi nhiều API, tỷ lệ lấy mẫu = 1)
  expect(body.stats.slowRoutes.length).toBeGreaterThan(0);
  for (const r of body.stats.slowRoutes) {
    expect(r.name.startsWith("/api/")).toBe(true);
    expect(r.samples).toBeGreaterThanOrEqual(3);
    expect(r.avgMs).toBeGreaterThanOrEqual(0);
  }
  expect(body.anomalies.some((a) => a.type === "ip_blocked" && a.message.includes(ip))).toBe(true);
  expect(body.telegram.tokenSet).toBe(false);

  // Giao diện: bất thường "Chặn IP", Telegram chưa cấu hình, IP bị chặn có trong bảng → bỏ chặn
  await page.getByRole("button", { name: "Tải lại" }).first().click();
  await expect(page.getByTestId("traffic-anomalies").getByText(ip).first()).toBeVisible();
  await expect(page.getByTestId("traffic-telegram")).toContainText("TELEGRAM_BOT_TOKEN");
  const row = page.getByTestId("traffic-blocks").getByRole("listitem").filter({ hasText: ip });
  await row.getByRole("button", { name: "Bỏ chặn" }).click();
  await expect(page.getByTestId("traffic-blocks").getByText(`Đã bỏ chặn ${ip}.`)).toBeVisible();

  // Telegram chưa có token → API báo lỗi rõ ràng
  const tg = await page.request.post("/api/v1/admin/traffic/telegram", { data: { action: "test" } });
  expect(tg.status()).toBe(400);

  // ── Cron gộp số liệu hôm qua vào bảng theo ngày; khoảng 30 ngày đọc từ bảng ──
  const cron = await request.get("/api/cron/daily", { headers: { authorization: "Bearer e2e-cron-secret-0123456789" } });
  expect(cron.status()).toBe(200);
  expect(((await cron.json()) as { traffic: { day: string } | null }).traffic?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.getByRole("tab", { name: "30 ngày" }).click();
  await expect(dash.getByText("30 ngày: tổng hợp theo ngày")).toBeVisible();
});
