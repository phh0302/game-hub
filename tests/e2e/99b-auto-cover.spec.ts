import { expect, test, type APIRequestContext } from "@playwright/test";
import { zipSync } from "fflate";
import { installWallet, login } from "./wallet";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const HTML = Buffer.from("<!doctype html><title>cover</title><p>ok</p>");

async function uploadBuild(api: APIRequestContext, gameId: string, version: string, files: Record<string, Uint8Array>) {
  const zip = Buffer.from(zipSync(files));
  const ticket = await api.post("/api/v1/developer/uploads", { data: { kind: "build", contentType: "application/zip", size: zip.length } });
  expect(ticket.status()).toBe(200);
  const { upload } = (await ticket.json()) as { upload: { url: string; headers: Record<string, string>; key: string } };
  expect((await api.put(upload.url, { headers: upload.headers, data: zip })).ok()).toBe(true);
  const res = await api.post(`/api/v1/developer/games/${gameId}/versions`, { data: { version, uploadKey: upload.key } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { version: { autoCover: { path: string; thumbnailUrl: string } | null } }).version;
}

/** Game chưa có ảnh bìa → hub tự lấy og-image.png / cover.png trong bản build; nút "Lấy ảnh bìa từ bản build" cho game cũ */
test("ảnh bìa tự lấy từ bản build", async ({ page }) => {
  test.setTimeout(90_000);
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  const api = page.request;
  const studio = await api.get("/api/v1/developer/studio");
  if (!((await studio.json()) as { studio: unknown }).studio) {
    expect((await api.post("/api/v1/developer/studio", { data: { name: "E2E Studio", slug: "e2e-studio", acceptTerms: true } })).status()).toBe(201);
  }
  const slug = `e2e-cover-${Date.now().toString(36)}`;
  const created = await api.post("/api/v1/developer/games", { data: { slug, translations: [{ locale: "vi", name: "E2E Cover" }] } });
  expect(created.status()).toBe(201);
  const gameId = ((await created.json()) as { game: { id: string } }).game.id;

  // Bản build không có ảnh bìa → không đổi gì
  expect((await uploadBuild(api, gameId, "1.0.0", { "index.html": HTML })).autoCover).toBeNull();
  // Nút lấy bìa: bản build không có ảnh → báo rõ
  const none = await api.post(`/api/v1/developer/games/${gameId}/cover/auto`);
  expect(none.status()).toBe(404);
  expect(((await none.json()) as { error: { code: string } }).error.code).toBe("NO_COVER_IN_BUILD");

  // File giả đuôi .png bị bỏ qua, og-image.png thật được lấy làm bìa
  const v2 = await uploadBuild(api, gameId, "1.0.1", {
    "index.html": HTML,
    "cover.png": Buffer.from("<svg onload=alert(1)>"),
    "og-image.png": PNG,
  });
  expect(v2.autoCover?.path).toBe("og-image.png");
  const game = async () => ((await (await api.get(`/api/v1/developer/games/${gameId}`)).json()) as { game: { thumbnailUrl: string | null } }).game;
  const url = (await game()).thumbnailUrl;
  expect(url).toMatch(/u\/images\/.+\/auto-[0-9a-f-]+\.png$/);

  // Đã có bìa → bản sau không đè
  expect((await uploadBuild(api, gameId, "1.0.2", { "index.html": HTML, "cover.png": PNG })).autoCover).toBeNull();
  expect((await game()).thumbnailUrl).toBe(url);

  // Game cũ (xóa bìa) → nút trong Studio lấy lại từ bản build mới nhất
  expect((await api.patch(`/api/v1/developer/games/${gameId}`, { data: { thumbnailKey: null } })).ok()).toBe(true);
  await page.goto(`/developer/games/${gameId}`);
  await page.getByRole("button", { name: "Lấy ảnh bìa từ bản build" }).click();
  await expect(page.getByText("Đã lấy ảnh bìa từ cover.png")).toBeVisible();
  expect((await game()).thumbnailUrl).toBeTruthy();
  await expect(page.getByRole("button", { name: "Lấy ảnh bìa từ bản build" })).toHaveCount(0);
});
