import { defineConfig, devices } from "@playwright/test";

/**
 * Test trình duyệt (end-to-end) – chạy trên bản build production với database thật.
 * Máy dev: chạy `npm run build` + database đã migrate/seed, rồi `npm run test:e2e`
 * (cần ADMIN_WALLETS chứa ví admin của test, xem tests/e2e/wallet.ts).
 * CI: job "e2e" trong .github/workflows/ci.yml.
 */
export default defineConfig({
  testDir: "tests/e2e",
  // Các file test dùng chung 1 database và chạy theo thứ tự tên file (1-…, 2-…, 3-…)
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    locale: "vi-VN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/api/v1/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
