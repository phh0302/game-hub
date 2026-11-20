import { expect, test } from "@playwright/test";
import { installWallet, login } from "./wallet";

/** Developer tự đổi bản đang chạy (rollback) sang phiên bản đã duyệt của game mình */
test("developer: rollback về bản cũ đã duyệt; bản chưa duyệt thì không được", async ({ page }) => {
  test.setTimeout(60_000);
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");

  const ids = await page.evaluate(async () => {
    const call = async (url: string, method = "GET", body?: unknown) => {
      const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    };
    // Ví admin cũng là developer (studio tạo ở 4-platform; tạo nếu chưa có)
    let studio = (await call("/api/v1/developer/studio")).data.studio;
    if (!studio) {
      studio = (await call("/api/v1/developer/studio", "POST", { name: "E2E Studio", slug: "e2e-studio", acceptTerms: true })).data.studio;
    }
    const slug = `e2e-rollback-${Date.now() % 100000}`;
    const game = (
      await call("/api/v1/admin/games", "POST", {
        slug,
        studioId: studio.id,
        status: "PENDING_REVIEW",
        translations: [{ locale: "vi", name: "E2E Rollback" }],
      })
    ).data.game;
    const add = async (version: string) =>
      (await call(`/api/v1/admin/games/${game.id}/versions`, "POST", { version, storageKey: "games/2048/1.0.0" })).data.version.id as string;
    const v1 = await add("1.0.0");
    const v2 = await add("1.1.0");
    const v3 = await add("1.2.0");
    await call(`/api/v1/admin/games/${game.id}/versions/${v1}`, "PATCH", { status: "APPROVED" }); // tự chạy + phát hành
    await call(`/api/v1/admin/games/${game.id}/versions/${v2}`, "PATCH", { status: "APPROVED" });
    await call(`/api/v1/admin/games/${game.id}/versions/${v2}/activate`, "POST");
    // v3 chưa duyệt → developer không đặt được
    const denied = await call(`/api/v1/developer/games/${game.id}/versions/${v3}/activate`, "POST");
    return { gameId: game.id as string, slug, deniedStatus: denied.status, deniedCode: denied.data?.error?.code };
  });
  expect(ids.deniedStatus).toBe(409);
  expect(ids.deniedCode).toBe("VERSION_NOT_APPROVED");

  await page.goto(`/developer/games/${ids.gameId}`);
  const row = (v: string) => page.getByRole("listitem").filter({ hasText: `v${v}` });
  await expect(row("1.1.0").getByText("đang chạy")).toBeVisible();
  await expect(row("1.2.0").getByRole("button", { name: "Đặt làm bản chạy" })).toHaveCount(0);

  page.once("dialog", (d) => void d.accept());
  await row("1.0.0").getByRole("button", { name: "Đặt làm bản chạy" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã đặt v1.0.0 làm bản đang chạy." })).toBeVisible();
  await expect(row("1.0.0").getByText("đang chạy")).toBeVisible();
  await expect(row("1.1.0").getByRole("button", { name: "Đặt làm bản chạy" })).toBeVisible();

  // Nhật ký hoạt động: admin duyệt + đổi bản chạy hiện trên trang; mục điểm bị từ chối có mặt
  await expect(page.getByTestId("platform-log")).toContainText("Admin duyệt");
  await expect(page.getByTestId("platform-log")).toContainText("Đổi bản đang chạy");
  await expect(page.getByTestId("rejected-30d")).toContainText("Chưa có điểm nào bị từ chối.");
  const events = await page.evaluate(async (gameId) => (await fetch(`/api/v1/developer/games/${gameId}/events`)).json(), ids.gameId);
  expect(JSON.stringify(events)).toContain("version.activate");

  // ── Admin đổi luật bảng → developer thấy trong nhật ký (trước → sau) ──
  // ── Điểm bị từ chối vượt ngưỡng (CI: 3 / giờ) → nhật ký + khung cảnh báo trên trang game ──
  await page.evaluate(async ({ gameId, slug }) => {
    const call = (url: string, method: string, body?: unknown) =>
      fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
    const boards = (await call(`/api/v1/admin/games/${gameId}/leaderboards`, "GET")).leaderboards as { id: string; key: string }[];
    const def = boards.find((b) => b.key === "default")!;
    await call(`/api/v1/admin/leaderboards/${def.id}`, "PATCH", { maxScore: 5 });
    for (let i = 0; i < 3; i++) {
      const { sessionId } = await call(`/api/v1/games/${slug}/sessions`, "POST", {});
      await call(`/api/v1/games/${slug}/scores`, "POST", { sessionId, score: 999 }); // > maxScore → SCORE_INVALID
    }
  }, { gameId: ids.gameId, slug: ids.slug });
  await page.reload();
  await expect(page.getByTestId("reject-warning")).toContainText("3 điểm bị từ chối trong 24 giờ qua");
  await expect(page.getByTestId("reject-warning")).toContainText("SCORE_INVALID");
  const log = page.getByTestId("platform-log");
  await expect(log).toContainText("Admin đổi luật bảng");
  await expect(log).toContainText("maxScore: – → 5");
  await expect(log).toContainText("Điểm bị từ chối tăng");
  await expect(page.getByTestId("rejected-30d")).toContainText("SCORE_INVALID");
});
