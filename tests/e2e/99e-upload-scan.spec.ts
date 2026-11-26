import { expect, test, type APIRequestContext } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
import { installWallet, login } from "./wallet";

async function uploadBuild(api: APIRequestContext, gameId: string, version: string, files: Record<string, Uint8Array>) {
  const zip = Buffer.from(zipSync(files));
  const ticket = await api.post("/api/v1/developer/uploads", { data: { kind: "build", contentType: "application/zip", size: zip.length } });
  const { upload } = (await ticket.json()) as { upload: { url: string; headers: Record<string, string>; key: string } };
  expect((await api.put(upload.url, { headers: upload.headers, data: zip })).ok()).toBe(true);
  const res = await api.post(`/api/v1/developer/games/${gameId}/versions`, { data: { version, uploadKey: upload.key } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { version: { id: string; scan: { level: string; findings: { rule: string }[] } } }).version;
}

/** Quét bản build khi upload: đào coin / lừa ví chặn duyệt cho tới khi admin xác nhận; game sạch duyệt bình thường */
test("quét bản build: critical chặn duyệt, admin xác nhận mới duyệt được", async ({ page }) => {
  test.setTimeout(90_000);
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  const api = page.request;
  if (!((await (await api.get("/api/v1/developer/studio")).json()) as { studio: unknown }).studio) {
    await api.post("/api/v1/developer/studio", { data: { name: "E2E Studio", slug: "e2e-studio", acceptTerms: true } });
  }
  const slug = `e2e-scan-${Date.now().toString(36)}`;
  const created = await api.post("/api/v1/developer/games", { data: { slug, translations: [{ locale: "vi", name: "Scan test" }] } });
  const gameId = ((await created.json()) as { game: { id: string } }).game.id;

  const html = strToU8("<!doctype html><canvas></canvas><script src='game.js'></script>");
  const clean = await uploadBuild(api, gameId, "1.0.0", { "index.html": html, "game.js": strToU8("let s=0;") });
  expect(clean.scan.level).toBe("clean");

  const bad = await uploadBuild(api, gameId, "1.0.1", {
    "index.html": strToU8("<!doctype html><p>Nhập seed phrase để nhận thưởng</p><script src='game.js'></script>"),
    "game.js": strToU8("var m = new CoinHive.Anonymous('k'); m.start();"),
  });
  expect(bad.scan.level).toBe("critical");
  expect(bad.scan.findings.map((f) => f.rule)).toEqual(expect.arrayContaining(["crypto_miner", "wallet_phishing"]));

  const review = (ack?: boolean) =>
    api.patch(`/api/v1/admin/games/${gameId}/versions/${bad.id}`, { data: { status: "APPROVED", ...(ack ? { acknowledgeScan: true } : {}) } });
  const blocked = await review();
  expect(blocked.status()).toBe(409);
  expect(((await blocked.json()) as { error: { code: string } }).error.code).toBe("SCAN_CRITICAL");

  // Quản trị: hiện kết quả quét + nút "Duyệt dù có cảnh báo"
  await page.goto("/admin");
  await expect(page.locator(`[data-testid="scan-level"][data-level="critical"]`).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Duyệt dù có cảnh báo" }).first()).toBeVisible();
  // Studio của developer cũng thấy cảnh báo
  await page.goto(`/developer/games/${gameId}`);
  await expect(page.getByText("Đào tiền ảo").first()).toBeVisible();

  expect((await review(true)).ok()).toBe(true);
  // Từ chối luôn được, không cần xác nhận
  expect(
    (await api.patch(`/api/v1/admin/games/${gameId}/versions/${clean.id}`, { data: { status: "REJECTED" } })).status(),
  ).toBeLessThan(500);
});
