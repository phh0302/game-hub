import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { installWallet, login } from "./wallet";

/**
 * Server API (/api/s1): máy chủ của game dùng secret key – nộp điểm ở chế độ "máy chủ xác nhận",
 * xuất / xóa điểm, cấm người chơi trong project, tạo giải đấu; nhật ký hiện trên trang Developer.
 */
const GAME_ORIGIN = "http://127.0.0.1:3000";

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

/** Gọi API như máy chủ / game bên ngoài (không cookie) → trả { status, code, body } */
async function call(request: APIRequestContext, method: string, url: string, headers: Record<string, string>, data?: unknown) {
  const res = await request.fetch(url, { method, headers, data: data === undefined ? undefined : data });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> & { error?: { code?: string } };
  return { status: res.status(), code: body?.error?.code ?? "OK", body };
}

test("Server API: secret key, máy chủ nộp điểm, xuất / xóa điểm, cấm người chơi, giải đấu, nhật ký", async ({
  page,
  playwright,
}) => {
  test.setTimeout(120_000);

  // ── Developer tạo game, khai báo domain, tạo publishable key (API) + secret key (giao diện) ──
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  const studio = await hubApi<{ studio: unknown }>(page, "/developer/studio");
  if (studio.status !== 200 || !studio.data.studio) {
    expect((await hubApi(page, "/developer/studio", "POST", { name: "E2E Studio", slug: "e2e-studio", acceptTerms: true })).status).toBe(201);
  }
  const created = await hubApi<{ game: { id: string } }>(page, "/developer/games", "POST", {
    slug: "e2e-server-api",
    translations: [{ locale: "vi", name: "E2E Server API" }],
  });
  let gameId = created.data?.game?.id;
  if (created.status === 409) {
    const list = await hubApi<{ games: { id: string; slug: string }[] }>(page, "/developer/games");
    gameId = list.data.games.find((g) => g.slug === "e2e-server-api")!.id;
  } else {
    expect(created.status).toBe(201);
  }
  expect((await hubApi(page, `/developer/games/${gameId}`, "PATCH", { allowedOrigins: [GAME_ORIGIN] })).status).toBe(200);
  const pk = await hubApi<{ key: string }>(page, `/developer/games/${gameId}/keys`, "POST", { kind: "PUBLISHABLE" });
  expect(pk.status).toBe(201);

  await page.goto(`/developer/games/${gameId}`);
  await page.getByRole("button", { name: "+ Tạo secret key" }).click();
  const sk = (await page.getByTestId("new-api-key").textContent())!.trim();
  expect(sk).toMatch(/^sk_live_[0-9A-Za-z]{32}$/);

  const api = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  const server = { authorization: `Bearer ${sk}` };
  const client = { "x-gamehub-key": pk.data.key, origin: GAME_ORIGIN };

  // Key sai loại / sai → 401
  expect((await call(api, "GET", "/api/s1/project", { authorization: `Bearer ${pk.data.key}` })).code).toBe("INVALID_SECRET_KEY");
  expect((await call(api, "GET", "/api/s1/project", {})).code).toBe("INVALID_SECRET_KEY");
  const project = await call(api, "GET", "/api/s1/project", server);
  expect(project.status).toBe(200);
  expect((project.body.project as { slug: string; scoreSubmission: string }).scoreSubmission).toBe("client");

  // ── Bật "chỉ máy chủ nộp điểm" trên giao diện ──
  await page.getByLabel("Nhận điểm từ").selectOption("server");
  await page.getByRole("button", { name: "Lưu cách nhận điểm" }).click();
  await expect(page.getByText("Đã lưu cách nhận điểm.")).toBeVisible();

  // Người chơi khách mở lượt chơi qua Client API
  const guest = await call(api, "POST", "/api/p1/auth/guest", client);
  expect(guest.status).toBe(201);
  const player = { ...client, authorization: `Bearer ${guest.body.token as string}` };
  const playerId = (guest.body.player as { id: string }).id;
  const s1 = await call(api, "POST", "/api/p1/sessions", player, {});
  expect(s1.status).toBe(201);
  const sessionId = s1.body.sessionId as string;

  // Trình duyệt nộp điểm → bị chặn; máy chủ nộp → được
  expect((await call(api, "POST", "/api/p1/scores", player, { sessionId, score: 42 })).code).toBe("SERVER_SCORING_ONLY");
  const submitted = await call(api, "POST", "/api/s1/scores", server, { sessionId, score: 42 });
  expect(submitted.status).toBe(201);
  expect((submitted.body.score as { value: number }).value).toBe(42);
  // Lượt chơi của game khác / không tồn tại
  expect((await call(api, "POST", "/api/s1/scores", server, { sessionId: "nope", score: 1 })).code).toBe("SESSION_NOT_FOUND");

  // ── Xuất điểm ──
  const exported = await call(api, "GET", "/api/s1/scores?leaderboard=default&limit=50", server);
  const rows = exported.body.scores as { id: string; value: number; player: { id: string } }[];
  const row = rows.find((r) => r.player.id === playerId)!;
  expect(row.value).toBe(42);

  // Thông tin người chơi
  const info = await call(api, "GET", `/api/s1/players/${playerId}`, server);
  expect(info.status).toBe(200);
  expect((info.body.boards as { leaderboard: string; best: number }[])[0]).toMatchObject({ leaderboard: "default", best: 42 });

  // ── Xóa điểm gian lận ──
  expect((await call(api, "DELETE", `/api/s1/scores/${row.id}?reason=e2e`, server)).body).toMatchObject({ deleted: 1 });
  const after = await call(api, "GET", "/api/s1/scores?limit=50", server);
  expect((after.body.scores as { id: string }[]).some((r) => r.id === row.id)).toBe(false);

  // ── Cấm người chơi trong project → không mở lượt chơi được; bỏ cấm → chơi lại được ──
  expect((await call(api, "PUT", `/api/s1/players/${playerId}/ban`, server, { reason: "e2e" })).body).toMatchObject({ banned: true });
  expect((await call(api, "POST", "/api/p1/sessions", player, {})).code).toBe("PLAYER_BANNED");
  expect((await call(api, "DELETE", `/api/s1/players/${playerId}/ban`, server)).body).toMatchObject({ banned: false });
  expect((await call(api, "POST", "/api/p1/sessions", player, {})).status).toBe(201);

  // ── Tạo giải đấu ăn theo bảng default ──
  const now = Date.now();
  const tour = await call(api, "POST", "/api/s1/leaderboards", server, {
    key: "e2e-cup",
    names: { vi: "Cúp E2E" },
    mirrorOf: "default",
    startsAt: new Date(now - 60_000).toISOString(),
    endsAt: new Date(now + 3_600_000).toISOString(),
  });
  expect([201, 409]).toContain(tour.status);
  const boards = await call(api, "GET", "/api/s1/leaderboards", server);
  expect((boards.body.leaderboards as { key: string }[]).map((b) => b.key)).toContain("e2e-cup");

  // ── Nhật ký trên trang Developer ──
  await page.reload();
  const log = page.getByTestId("platform-log");
  await expect(log).toContainText("Tạo key");
  await expect(log).toContainText("Đổi cách nhận điểm");
  await expect(log).toContainText("Điểm bị xóa");
  await expect(log).toContainText("Cấm người chơi");
  await expect(log).toContainText("Bỏ cấm người chơi");

  // Thu hồi secret key → máy chủ ngừng gọi được
  const keys = await hubApi<{ keys: { id: string; kind: string; revokedAt: string | null }[] }>(page, `/developer/games/${gameId}/keys`);
  for (const k of keys.data.keys.filter((k) => k.kind === "SECRET" && !k.revokedAt)) {
    await hubApi(page, `/developer/games/${gameId}/keys/${k.id}`, "DELETE");
  }
  expect((await call(api, "GET", "/api/s1/project", server)).code).toBe("INVALID_SECRET_KEY");
  await api.dispose();
});
