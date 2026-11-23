import { expect, test } from "@playwright/test";

/** Mã request + header bảo mật (security audit 11/2026) */
test("API trả mã request riêng cho từng request, không nhận mã client tự đặt", async ({ request }) => {
  const a = await request.get("/api/v1/games", { headers: { "x-request-id": "id-from-client-0001" } });
  const b = await request.get("/api/v1/games");
  const idA = a.headers()["x-request-id"];
  const idB = b.headers()["x-request-id"];
  expect(idA).toMatch(/^[A-Za-z0-9:._-]{8,128}$/);
  expect(idB).toMatch(/^[A-Za-z0-9:._-]{8,128}$/);
  expect(idA).not.toBe(idB);
  expect(idA).not.toContain("from-client");

  // Lỗi do lớp chặn (413) cũng có mã request
  const big = await request.post("/api/v1/client-errors", {
    headers: { "content-type": "application/json" },
    data: JSON.stringify({ message: "x".repeat(70 * 1024) }),
  });
  expect(big.status()).toBe(413);
  expect(big.headers()["x-request-id"]).toBeTruthy();
});

test("trang hub có CSP nền + HSTS; file game giữ CSP sandbox", async ({ request }) => {
  const home = await request.get("/");
  const h = home.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");

  const game = await request.get("/uploads/games/save-demo/1.0.0/index.html");
  expect(game.status()).toBe(200);
  expect(game.headers()["content-security-policy"]).toContain("sandbox");
  expect(game.headers()["content-security-policy"]).not.toContain("frame-ancestors 'none'");
});
