import { expect, test, type Page } from "@playwright/test";
import { installWallet, login } from "./wallet";

/** Phòng chơi theo lượt: tạo phòng → bạn vào bằng link mời → chủ phòng bắt đầu → lần lượt đi → có người thắng */
test("phòng chơi theo lượt: caro 3×3 giữa 2 người", async ({ page, browser }) => {
  test.setTimeout(120_000);

  // Admin đưa game mẫu Caro (public/uploads/games/rooms-demo) lên
  await installWallet(page, "admin");
  await page.goto("/");
  await login(page, "admin");
  await page.evaluate(async () => {
    const call = (url: string, method: string, body?: unknown) =>
      fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
    const list = (await call("/api/v1/admin/games", "GET")).games as { id: string; slug: string }[];
    let game = list.find((g) => g.slug === "e2e-caro");
    if (!game) {
      game = (await call("/api/v1/admin/games", "POST", { slug: "e2e-caro", status: "PENDING_REVIEW", translations: [{ locale: "vi", name: "E2E Caro" }] })).game;
    }
    const v = (await call(`/api/v1/admin/games/${game!.id}/versions`, "POST", { version: `1.0.${Date.now() % 100000}`, storageKey: "games/rooms-demo/1.0.0" })).version;
    await call(`/api/v1/admin/games/${game!.id}/versions/${v.id}`, "PATCH", { status: "APPROVED" });
    await call(`/api/v1/admin/games/${game!.id}/versions/${v.id}/activate`, "POST");
    await call(`/api/v1/admin/games/${game!.id}`, "PATCH", { status: "PUBLISHED" });
  });

  const open = async (wallet: "player" | "fresh", path: string): Promise<Page> => {
    const ctx = await browser.newContext({ locale: "vi-VN" });
    const p = await ctx.newPage();
    await installWallet(p, wallet);
    await p.goto("/");
    await login(p, wallet);
    await p.goto(path);
    return p;
  };

  // Chủ phòng (X)
  const a = await open("player", "/games/e2e-caro");
  const ga = a.frameLocator("iframe");
  await expect(ga.getByTestId("log")).toContainText("init rooms=true roomCode=null");
  await ga.getByRole("button", { name: "Tạo phòng" }).click();
  await expect(ga.locator("#code")).toHaveText(/^[A-Z2-9]{6}$/);
  const code = (await ga.locator("#code").textContent())!;
  await expect(ga.getByTestId("status")).toContainText("Đang chờ (1/2)");

  // Mời bạn → link có ?room=
  await ga.getByRole("button", { name: "Mời bạn" }).click();
  const sheet = a.getByTestId("share-sheet");
  await expect(sheet).toContainText(`Vào phòng ${code}`);
  expect(await sheet.locator("input").inputValue()).toContain(`room=${code}`);
  await sheet.getByRole("button", { name: "Đóng" }).click();

  // Bạn (O) mở link mời → tự vào phòng
  const b = await open("fresh", `/games/e2e-caro?room=${code}`);
  const gb = b.frameLocator("iframe");
  await expect(gb.getByTestId("log")).toContainText(`joined ${code}`);
  await expect(ga.getByTestId("status")).toContainText("Đang chờ (2/2)", { timeout: 10_000 });

  // Người thứ 3 không vào được phòng đầy; người ngoài không đi được
  const full = await page.request.post(`/api/v1/games/e2e-caro/rooms/${code}/join`);
  expect(full.status()).toBe(409);
  expect((await full.json()).error.code).toBe("ROOM_FULL");
  expect((await b.request.post(`/api/v1/games/e2e-caro/rooms/${code}/start`)).status()).toBe(403); // không phải chủ phòng

  await ga.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(ga.getByTestId("status")).toHaveText("Tới lượt bạn");
  await expect(gb.getByTestId("status")).toHaveText("Chờ đối thủ…", { timeout: 10_000 });
  // Đi sai lượt → 409
  const early = await b.request.post(`/api/v1/games/e2e-caro/rooms/${code}/move`, { data: { data: { cell: 8 } } });
  expect((await early.json()).error.code).toBe("NOT_YOUR_TURN");

  const cell = (g: typeof ga, i: number) => g.locator(`[data-cell="${i}"]`);
  // X: 0, O: 3, X: 1, O: 4, X: 2 → X thắng
  for (const [g, i] of [[ga, 0], [gb, 3], [ga, 1], [gb, 4], [ga, 2]] as const) {
    await expect(cell(g, i)).toBeEnabled({ timeout: 10_000 });
    await cell(g, i).click();
  }
  await expect(ga.getByTestId("status")).toHaveText("Bạn thắng!");
  await expect(gb.getByTestId("status")).toHaveText("Bạn thua!", { timeout: 10_000 });
  await expect(cell(gb, 2)).toHaveText("X");

  // Phòng đã kết thúc: lịch sử nước đi đủ 5 bước
  const room = (await (await page.request.get(`/api/v1/games/e2e-caro/rooms/${code}?since=0`)).json()).room;
  expect(room.status).toBe("FINISHED");
  expect(room.result).toMatchObject({ reason: "finished", winnerSeat: 0 });
  expect(room.moves.map((m: { seat: number; data: { cell: number } }) => `${m.seat}:${m.data.cell}`)).toEqual(["0:0", "1:3", "0:1", "1:4", "0:2"]);
});
