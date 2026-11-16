import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { installWallet, login } from "./wallet";

/**
 * Gói & hạn mức (12c): admin gán gói, Free không có Server API / webhook, có "Powered by Monlabs";
 * hết hạn mức lần lưu điểm / người chơi → vẫn chơi được nhưng không lưu điểm; cảnh báo hiện ở trang Developer.
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

async function call(request: APIRequestContext, method: string, url: string, headers: Record<string, string>, data?: unknown) {
  const res = await request.fetch(url, { method, headers, data });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> & { error?: { code?: string } };
  return { status: res.status(), code: body?.error?.code ?? "OK", body };
}

type Summary = { plan: string; usage: { metric: string; used: number; limit: number | null }[] };

test("Gói & hạn mức: Free chặn Server API / webhook, hết hạn mức thì không lưu điểm, cảnh báo cho developer", async ({
  page,
  playwright,
}) => {
  test.setTimeout(120_000);
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");

  const studio = await hubApi<{ studio: { id: string } | null }>(page, "/developer/studio");
  if (!studio.data.studio) {
    expect((await hubApi(page, "/developer/studio", "POST", { name: "E2E Studio", slug: "e2e-studio", acceptTerms: true })).status).toBe(201);
  }
  const { id: studioId, slug: studioSlug } = (await hubApi<{ studio: { id: string; slug: string } }>(page, "/developer/studio")).data.studio;
  const setPlan = async (body: unknown) => expect((await hubApi(page, `/admin/studios/${studioId}/plan`, "PUT", body)).status).toBe(200);

  const created = await hubApi<{ game: { id: string } }>(page, "/developer/games", "POST", {
    slug: "e2e-quota",
    translations: [{ locale: "vi", name: "E2E Quota" }],
  });
  let gameId = created.data?.game?.id;
  if (created.status === 409) {
    const list = await hubApi<{ games: { id: string; slug: string }[] }>(page, "/developer/games");
    gameId = list.data.games.find((g) => g.slug === "e2e-quota")!.id;
  }
  expect((await hubApi(page, `/developer/games/${gameId}`, "PATCH", { allowedOrigins: [GAME_ORIGIN] })).status).toBe(200);

  // Hạn mức đặt sát mức đang dùng của tháng (các test trước đã dùng Platform API)
  await setPlan({ plan: "PRO" });
  const pk = await hubApi<{ key: string }>(page, `/developer/games/${gameId}/keys`, "POST", { kind: "PUBLISHABLE" });
  expect(pk.status).toBe(201);
  const before = (await hubApi<Summary>(page, "/developer/plan")).data;
  const used = (m: string) => before.usage.find((u) => u.metric === m)!.used;
  await setPlan({ plan: "FREE", limits: { projects: null, activePlayers: used("activePlayers") + 1, scores: used("scores") + 1 } });

  // ── Free: không có Server API / webhook ──
  const sk = await hubApi<{ error: { code: string } }>(page, `/developer/games/${gameId}/keys`, "POST", { kind: "SECRET" });
  expect(sk.data.error.code).toBe("PLAN_REQUIRED");
  const hook = await hubApi<{ error: { code: string } }>(page, `/developer/games/${gameId}/webhook`, "PUT", { url: "https://example.com/hook" });
  expect(hook.data.error.code).toBe("PLAN_REQUIRED");

  const api = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  const client = { "x-gamehub-key": pk.data.key, origin: GAME_ORIGIN };
  expect(((await call(api, "GET", "/api/p1/project", client)).body.project as { branding: boolean }).branding).toBe(true);

  async function guest() {
    const g = await call(api, "POST", "/api/p1/auth/guest", client);
    expect(g.status).toBe(201);
    return { ...client, authorization: `Bearer ${g.body.token as string}` };
  }
  async function play(player: Record<string, string>, score: number) {
    const s = await call(api, "POST", "/api/p1/sessions", player, {});
    expect(s.status).toBe(201); // hết hạn mức vẫn được chơi
    return call(api, "POST", "/api/p1/scores", player, { sessionId: s.body.sessionId, score });
  }

  // ── Hạn mức lần lưu điểm ──
  const a = await guest();
  expect((await play(a, 5)).status).toBe(201); // chạm 100%
  expect((await play(a, 6)).code).toBe("QUOTA_SCORES");

  // ── Hạn mức người chơi: người mới không được lưu điểm, người đã tính trong tháng vẫn được ──
  await setPlan({ plan: "FREE", limits: { projects: null, activePlayers: used("activePlayers") + 1, scores: null } });
  const b = await guest();
  expect((await play(b, 7)).code).toBe("QUOTA_PLAYERS");
  expect((await play(a, 8)).status).toBe(201);

  // ── Developer thấy gói + cảnh báo; nhật ký có cảnh báo hạn mức ──
  await page.goto("/developer");
  const box = page.getByTestId("plan-usage");
  await expect(box).toContainText("Free");
  await expect(box.getByRole("alert")).toContainText("Người chơi hoạt động / tháng");
  await page.goto(`/developer/games/${gameId}`);
  await expect(page.getByTestId("platform-log")).toContainText("Cảnh báo hạn mức");

  // ── Admin gán gói trên giao diện ──
  await page.goto("/admin");
  const row = page.getByTestId(`studio-plan-${studioSlug}`);
  await row.getByLabel(`Gói ${studioSlug}`).selectOption("PRO");
  for (const label of ["Game dùng Platform API", "Người chơi hoạt động / tháng", "Lần lưu điểm / tháng", "Giải đấu đang mở"]) {
    await row.getByLabel(`${label} ${studioSlug}`).fill("");
  }
  await row.getByRole("button", { name: "Lưu gói" }).click();
  await expect(row.getByText("Đã lưu gói.")).toBeVisible();

  // Pro: không còn chữ Powered by, người chơi mới lưu điểm được
  expect(((await call(api, "GET", "/api/p1/project", client)).body.project as { branding: boolean }).branding).toBe(false);
  expect((await play(b, 9)).status).toBe(201);
  await api.dispose();
});
