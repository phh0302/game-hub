import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import { installWallet, login } from "./wallet";
import { verifyWebhookSignature } from "../../src/modules/platform/webhook-utils";

/**
 * Webhook + số liệu: máy nhận webhook chạy ngay trong test (127.0.0.1:4010; CI bật WEBHOOK_ALLOW_PRIVATE=1).
 * Kiểm tra: gửi thử ping có chữ ký đúng, score.submitted sau khi nộp điểm, lỗi → gửi lại bằng tay, bảng số liệu.
 */
const GAME_ORIGIN = "http://127.0.0.1:3000";
const HOOK_PORT = 4010;

type Hit = { headers: IncomingHttpHeaders; body: string };

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

test("Webhook: ping có chữ ký, score.submitted, lỗi thì gửi lại; số liệu Platform API", async ({ page, playwright }) => {
  test.setTimeout(120_000);
  const hits: Hit[] = [];
  let failNext = false;
  const receiver: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      hits.push({ headers: req.headers, body });
      res.statusCode = failNext ? 500 : 200;
      res.end("ok");
    });
  });
  await new Promise<void>((r) => receiver.listen(HOOK_PORT, "127.0.0.1", r));

  try {
    // ── Developer tạo game + publishable key ──
    await installWallet(page, "admin");
    await page.goto("/");
    await login(page, "admin");
    const studio = await hubApi<{ studio: unknown }>(page, "/developer/studio");
    if (studio.status !== 200 || !studio.data.studio) {
      expect((await hubApi(page, "/developer/studio", "POST", { name: "E2E Studio", slug: "e2e-studio", acceptTerms: true })).status).toBe(201);
    }
    const created = await hubApi<{ game: { id: string } }>(page, "/developer/games", "POST", {
      slug: "e2e-webhooks",
      translations: [{ locale: "vi", name: "E2E Webhooks" }],
    });
    let gameId = created.data?.game?.id;
    if (created.status === 409) {
      const list = await hubApi<{ games: { id: string; slug: string }[] }>(page, "/developer/games");
      gameId = list.data.games.find((g) => g.slug === "e2e-webhooks")!.id;
    } else {
      expect(created.status).toBe(201);
    }
    expect((await hubApi(page, `/developer/games/${gameId}`, "PATCH", { allowedOrigins: [GAME_ORIGIN] })).status).toBe(200);
    const pk = await hubApi<{ key: string }>(page, `/developer/games/${gameId}/keys`, "POST", {});
    expect(pk.status).toBe(201);

    // URL không an toàn bị từ chối ngay cả khi cho phép mạng nội bộ (phải là http/https hợp lệ)
    expect((await hubApi<{ error: { code: string } }>(page, `/developer/games/${gameId}/webhook`, "PUT", { url: "ftp://x" })).data.error.code).toBe(
      "INVALID_WEBHOOK_URL",
    );

    // ── Đặt webhook trên giao diện → khóa ký hiện 1 lần (lần chạy lại: đổi khóa để lấy khóa mới) ──
    await page.goto(`/developer/games/${gameId}`);
    await page.getByLabel("URL nhận webhook").fill(`http://127.0.0.1:${HOOK_PORT}/hook`);
    await page.getByRole("button", { name: "Lưu webhook" }).click();
    await expect(page.getByText("Đã lưu webhook.")).toBeVisible();
    if (!(await page.getByTestId("webhook-secret").isVisible())) {
      await page.getByRole("button", { name: "Đổi khóa ký" }).click();
    }
    const secret = (await page.getByTestId("webhook-secret").textContent())!.trim();
    expect(secret).toMatch(/^whsec_[0-9A-Za-z]{32}$/);

    // Gửi thử
    await page.getByRole("button", { name: "Gửi thử" }).click();
    await expect(page.getByText("Gửi thành công.")).toBeVisible();
    const ping = hits.find((h) => h.headers["x-monlabs-event"] === "ping")!;
    expect(ping).toBeTruthy();
    expect(verifyWebhookSignature(secret, ping.headers["x-monlabs-signature"] as string, ping.body)).toBe(true);
    expect(verifyWebhookSignature("whsec_sai", ping.headers["x-monlabs-signature"] as string, ping.body)).toBe(false);

    // ── Người chơi nộp điểm → score.submitted ──
    const api = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    const client = { "x-gamehub-key": pk.data.key, origin: GAME_ORIGIN };
    const guest = await api.post("/api/p1/auth/guest", { headers: client });
    expect(guest.status()).toBe(201);
    const { token, player } = (await guest.json()) as { token: string; player: { id: string } };
    const auth = { ...client, authorization: `Bearer ${token}` };
    async function play(score: number) {
      const s = await api.post("/api/p1/sessions", { headers: auth, data: {} });
      const { sessionId } = (await s.json()) as { sessionId: string };
      const r = await api.post("/api/p1/scores", { headers: auth, data: { sessionId, score } });
      expect(r.status()).toBe(201);
    }

    await play(11);
    await expect
      .poll(() => hits.filter((h) => h.headers["x-monlabs-event"] === "score.submitted").length, { timeout: 15_000 })
      .toBe(1);
    const hit = hits.find((h) => h.headers["x-monlabs-event"] === "score.submitted")!;
    expect(verifyWebhookSignature(secret, hit.headers["x-monlabs-signature"] as string, hit.body)).toBe(true);
    const event = JSON.parse(hit.body) as { type: string; data: { playerId: string; value: number; via: string } };
    expect(event.type).toBe("score.submitted");
    expect(event.data).toMatchObject({ playerId: player.id, value: 11, via: "client" });

    // ── Máy nhận lỗi → sự kiện chờ gửi lại; bấm "Gửi lại" khi máy nhận đã ổn ──
    failNext = true;
    await play(12);
    await expect
      .poll(() => hits.filter((h) => h.headers["x-monlabs-event"] === "score.submitted").length, { timeout: 15_000 })
      .toBe(2);
    failNext = false;
    await page.reload();
    const deliveries = page.getByTestId("webhook-deliveries");
    await expect(deliveries).toContainText("HTTP 500");
    await deliveries.getByRole("button", { name: "Gửi lại" }).first().click();
    await expect(page.getByText("Gửi thành công.")).toBeVisible();
    expect(hits.filter((h) => h.headers["x-monlabs-event"] === "score.submitted").length).toBe(3);

    // ── Số liệu: 2 điểm, 2 lượt chơi, 1 người chơi hôm nay ──
    await page.reload();
    const totals = page.getByTestId("usage-totals");
    await expect(totals.getByRole("button", { name: /Điểm đã lưu/ })).toContainText(/\b2\b/);
    await expect(totals.getByRole("button", { name: /Lượt chơi/ })).toContainText(/\b2\b/);
    await expect(totals.getByRole("button", { name: /Người chơi/ })).toContainText(/\b1\b/);
    await api.dispose();
  } finally {
    await new Promise<void>((r) => receiver.close(() => r()));
  }
});
