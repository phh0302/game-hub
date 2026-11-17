import { expect, test } from "@playwright/test";
import { installWallet, login } from "./wallet";

/**
 * Lớp chặn chung ở middleware (13a): vượt giới hạn nhóm → 429 RATE_LIMITED + Retry-After;
 * gửi dồn dập → chặn tạm IP (IP_BLOCKED), admin bỏ chặn được; body quá lớn → 413.
 * Máy test được bỏ qua (TRAFFIC_EXEMPT_IPS) → giả IP khác bằng x-forwarded-for.
 */
test("Chống request dồn dập: 429 theo nhóm, chặn tạm IP, admin bỏ chặn, body quá lớn", async ({ page, request }) => {
  test.setTimeout(120_000);
  const suffix = Date.now() % 200;

  // ── Nhóm "auth": 30 request / phút ──
  const authIp = { "x-forwarded-for": `198.51.100.${suffix}` };
  const statuses: number[] = [];
  for (let i = 0; i < 31; i++) {
    const r = await request.post("/api/v1/auth/nonce", {
      headers: authIp,
      data: { address: "0x000000000000000000000000000000000000dEaD", chainId: 1 },
    });
    statuses.push(r.status());
    if (r.status() === 429) {
      expect(((await r.json()) as { error: { code: string } }).error.code).toBe("RATE_LIMITED");
      expect(Number(r.headers()["retry-after"])).toBeGreaterThan(0);
    }
  }
  expect(statuses.slice(0, 30).every((s) => s !== 429)).toBe(true);
  expect(statuses[30]).toBe(429);

  // ── Gửi dồn dập (> 150 request / 10 giây) → chặn tạm IP ──
  const burstIp = `203.0.113.${suffix}`;
  const burst = await Promise.all(
    Array.from({ length: 160 }, () => request.get("/api/v1/health", { headers: { "x-forwarded-for": burstIp } })),
  );
  const codes = await Promise.all(
    burst.filter((r) => r.status() === 429).map(async (r) => ((await r.json()) as { error: { code: string } }).error.code),
  );
  expect(codes).toContain("IP_BLOCKED");
  const after = await request.get("/api/v1/games", { headers: { "x-forwarded-for": burstIp } });
  expect(after.status()).toBe(429);
  expect(((await after.json()) as { error: { code: string } }).error.code).toBe("IP_BLOCKED");

  // ── Admin thấy IP bị chặn và bỏ chặn ──
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  await page.goto("/admin");
  const box = page.getByTestId("traffic-blocks");
  const row = box.getByRole("listitem").filter({ hasText: burstIp });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Bỏ chặn" }).click();
  await expect(box.getByText(`Đã bỏ chặn ${burstIp}.`)).toBeVisible();
  expect((await request.get("/api/v1/games", { headers: { "x-forwarded-for": burstIp } })).status()).toBe(200);

  // ── Body quá lớn bị chặn trước khi vào route ──
  const big = await request.post("/api/v1/games/2048/plays", {
    headers: { "x-forwarded-for": `192.0.2.${suffix}`, "content-type": "application/json" },
    data: JSON.stringify({ pad: "x".repeat(70 * 1024) }),
  });
  expect(big.status()).toBe(413);
});
