import { createServer, type Server } from "node:http";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { installWallet, login } from "./wallet";

/**
 * Các trường hợp biên của gói (12c):
 * - giải đấu vượt hạn mức → QUOTA_TOURNAMENTS (bảng phụ không thời hạn vẫn tạo được)
 * - hạ xuống Free → webhook ngừng gửi (vẫn lưu điểm)
 * - gói hết hạn → về Free, secret key đang có bị chặn (PLAN_REQUIRED)
 */
const GAME_ORIGIN = "http://127.0.0.1:3000";
const HOOK_PORT = 4011;

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

async function call(request: APIRequestContext, method: string, url: string, headers: Record<string, string>, data?: unknown) {
  const res = await request.fetch(url, { method, headers, data });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> & { error?: { code?: string } };
  return { status: res.status(), code: body?.error?.code ?? "OK", body };
}

type Summary = { plan: string; expired: boolean; usage: { metric: string; used: number }[] };

test("Gói: giới hạn giải đấu, hạ gói thì ngừng webhook, hết hạn thì chặn secret key", async ({ page, playwright }) => {
  test.setTimeout(120_000);
  let hits = 0;
  const receiver: Server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      if (req.headers["x-monlabs-event"] === "score.submitted") hits++;
      res.end("ok");
    });
  });
  await new Promise<void>((r) => receiver.listen(HOOK_PORT, "127.0.0.1", r));
  const api = await playwright.request.newContext({ baseURL: "http://localhost:3000" });

  try {
    await installWallet(page, "admin");
    await page.goto("/");
    await login(page, "admin");
    const studio = await hubApi<{ studio: { id: string } | null }>(page, "/developer/studio");
    if (!studio.data.studio) {
      expect((await hubApi(page, "/developer/studio", "POST", { name: "E2E Studio", slug: "e2e-studio", acceptTerms: true })).status).toBe(201);
    }
    const studioId = (await hubApi<{ studio: { id: string } }>(page, "/developer/studio")).data.studio.id;
    const setPlan = async (body: unknown) => expect((await hubApi(page, `/admin/studios/${studioId}/plan`, "PUT", body)).status).toBe(200);
    await setPlan({ plan: "PRO" });

    const created = await hubApi<{ game: { id: string } }>(page, "/developer/games", "POST", {
      slug: "e2e-plan-edge",
      translations: [{ locale: "vi", name: "E2E Plan edge" }],
    });
    let gameId = created.data?.game?.id;
    if (created.status === 409) {
      const list = await hubApi<{ games: { id: string; slug: string }[] }>(page, "/developer/games");
      gameId = list.data.games.find((g) => g.slug === "e2e-plan-edge")!.id;
    }
    expect((await hubApi(page, `/developer/games/${gameId}`, "PATCH", { allowedOrigins: [GAME_ORIGIN] })).status).toBe(200);
    const pk = await hubApi<{ key: string }>(page, `/developer/games/${gameId}/keys`, "POST", { kind: "PUBLISHABLE" });
    const sk = await hubApi<{ key: string }>(page, `/developer/games/${gameId}/keys`, "POST", { kind: "SECRET" });
    expect([pk.status, sk.status]).toEqual([201, 201]);
    const server = { authorization: `Bearer ${sk.data.key}` };
    const client = { "x-gamehub-key": pk.data.key, origin: GAME_ORIGIN };

    // ── Giải đấu: chỉ còn chỗ cho 1 giải đang mở ──
    const open = (await hubApi<Summary>(page, "/developer/plan")).data.usage.find((u) => u.metric === "openTournaments")!.used;
    await setPlan({ plan: "PRO", limits: { openTournaments: open + 1 } });
    const now = Date.now();
    const tour = (key: string, timed = true) => ({
      key,
      names: { vi: key },
      mirrorOf: "default",
      ...(timed ? { startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 3_600_000).toISOString() } : {}),
    });
    const suffix = String(now).slice(-6);
    expect((await call(api, "POST", "/api/s1/leaderboards", server, tour(`cup-a-${suffix}`))).status).toBe(201);
    expect((await call(api, "POST", "/api/s1/leaderboards", server, tour(`cup-b-${suffix}`))).code).toBe("QUOTA_TOURNAMENTS");
    // Bảng phụ không có thời hạn không tính là giải đấu đang mở
    expect((await call(api, "POST", "/api/s1/leaderboards", server, tour(`side-${suffix}`, false))).status).toBe(201);
    await setPlan({ plan: "PRO" });

    // ── Webhook: gửi khi Pro, ngừng khi hạ xuống Free ──
    expect(
      (await hubApi(page, `/developer/games/${gameId}/webhook`, "PUT", { url: `http://127.0.0.1:${HOOK_PORT}/hook` })).status,
    ).toBe(200);
    const g = await call(api, "POST", "/api/p1/auth/guest", client);
    expect(g.status).toBe(201);
    const player = { ...client, authorization: `Bearer ${g.body.token as string}` };
    async function play(score: number) {
      const s = await call(api, "POST", "/api/p1/sessions", player, {});
      return call(api, "POST", "/api/p1/scores", player, { sessionId: s.body.sessionId, score });
    }
    expect((await play(3)).status).toBe(201);
    await expect.poll(() => hits, { timeout: 15_000 }).toBe(1);
    const countDeliveries = async () =>
      (await hubApi<{ deliveries: { event: string }[] }>(page, `/developer/games/${gameId}/webhook`)).data.deliveries.filter(
        (d) => d.event === "score.submitted",
      ).length;
    const deliveriesBefore = await countDeliveries();

    await setPlan({ plan: "FREE", limits: { projects: null } });
    expect((await play(4)).status).toBe(201); // vẫn lưu điểm
    await page.waitForTimeout(3_000);
    expect(hits).toBe(1); // nhưng không gửi webhook
    expect(await countDeliveries()).toBe(deliveriesBefore);
    // Free cũng không gọi được Server API bằng secret key cũ
    expect((await call(api, "GET", "/api/s1/project", server)).code).toBe("PLAN_REQUIRED");

    // ── Gói Pro hết hạn → về Free: secret key bị chặn; gia hạn lại thì chạy ──
    await setPlan({ plan: "PRO", expiresAt: new Date(now - 86_400_000).toISOString() });
    const summary = (await hubApi<Summary>(page, "/developer/plan")).data;
    expect(summary).toMatchObject({ plan: "FREE", expired: true });
    expect((await call(api, "GET", "/api/s1/project", server)).code).toBe("PLAN_REQUIRED");
    expect(((await call(api, "GET", "/api/p1/project", client)).body.project as { branding: boolean }).branding).toBe(true);

    await setPlan({ plan: "PRO", expiresAt: new Date(now + 30 * 86_400_000).toISOString() });
    expect((await call(api, "GET", "/api/s1/project", server)).status).toBe(200);

    // Dọn: tắt webhook, gói Pro không thời hạn cho các lần chạy sau
    await hubApi(page, `/developer/games/${gameId}/webhook`, "PUT", { url: null });
    await setPlan({ plan: "PRO" });
  } finally {
    await api.dispose();
    await new Promise<void>((r) => receiver.close(() => r()));
  }
});
