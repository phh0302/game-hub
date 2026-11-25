import { expect, test, type APIRequestContext } from "@playwright/test";
import { installWallet, login } from "./wallet";

/**
 * Stress / giới hạn (chạy cuối vì có bước đốt hết hạn mức của IP).
 * Mục tiêu: chạm đúng biên → mã lỗi rõ ràng, không bao giờ 5xx, dữ liệu không hỏng khi gửi đồng thời.
 */
// Không chạy lại khi lỗi: lần chạy lại sẽ vướng hạn mức đã đốt ở lần trước (429) và che mất lỗi thật
test.describe.configure({ mode: "serial", retries: 0 });

const GAME = "memory";
const KB64 = 64 * 1024;

const no5xx = (statuses: number[]) => expect(statuses.filter((s) => s >= 500), `5xx: ${statuses.join(",")}`).toEqual([]);

async function playerApi(page: import("@playwright/test").Page): Promise<APIRequestContext> {
  await installWallet(page, "player");
  await page.goto("/");
  await login(page, "player");
  return page.request;
}

test("saveState: đúng 64KB nhận, 1 byte hơn bị chặn, tính theo byte UTF-8", async ({ page }) => {
  const api = await playerApi(page);
  const put = (body: string) => api.put(`/api/v1/games/${GAME}/state`, { headers: { "content-type": "text/plain" }, data: body });

  const exact = JSON.stringify("a".repeat(KB64 - 2)); // "…" = đúng 65.536 byte
  expect(Buffer.byteLength(exact)).toBe(KB64);
  expect((await put(exact)).status()).toBe(200);
  const back = await (await api.get(`/api/v1/games/${GAME}/state`)).json();
  expect(back.data.length).toBe(KB64);

  const over = JSON.stringify("a".repeat(KB64 - 1));
  const r1 = await put(over);
  expect(r1.status()).toBe(413);
  expect((await r1.json()).error.code).toBe("STATE_TOO_LARGE");

  // 21.845 ký tự "ệ" (3 byte/ký tự) = 65.537 byte dù chưa tới 65.536 ký tự
  const multibyte = JSON.stringify("ệ".repeat(21_845));
  expect(multibyte.length).toBeLessThan(KB64);
  expect((await put(multibyte)).status()).toBe(413);

  // Quá giới hạn của lớp chặn (256KB) → 413 trước khi vào route
  expect((await put(JSON.stringify("b".repeat(300 * 1024)))).status()).toBe(413);
  // Không phải JSON
  const bad = await put("{not json");
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error.code).toBe("STATE_INVALID");
  // Dữ liệu cũ vẫn nguyên sau các lần bị từ chối
  expect((await (await api.get(`/api/v1/games/${GAME}/state`)).json()).data.length).toBe(KB64);
});

test("saveState: 20 lần lưu đồng thời → không lỗi, kết quả cuối là 1 bản trọn vẹn", async ({ page }) => {
  const api = await playerApi(page);
  const bodies = Array.from({ length: 20 }, (_, i) => JSON.stringify({ writer: i, filler: "x".repeat(2000 + i) }));
  const res = await Promise.all(
    bodies.map((b) => api.put(`/api/v1/games/${GAME}/state`, { headers: { "content-type": "text/plain" }, data: b })),
  );
  const statuses = res.map((r) => r.status());
  no5xx(statuses);
  expect(statuses.every((s) => s === 200 || s === 429)).toBe(true);
  const final = (await (await api.get(`/api/v1/games/${GAME}/state`)).json()).data as string;
  expect(bodies).toContain(final); // không bị trộn lẫn 2 bản
});

test("nộp điểm đồng thời cùng 1 lượt chơi → chỉ 1 lần được tính", async ({ page }) => {
  const api = await playerApi(page);
  const session = await api.post(`/api/v1/games/${GAME}/sessions`, { data: {} });
  expect(session.status()).toBe(201);
  const { sessionId } = await session.json();
  await page.waitForTimeout(4_000); // qua thời gian chơi tối thiểu
  const res = await Promise.all(
    Array.from({ length: 10 }, () => api.post(`/api/v1/games/${GAME}/scores`, { data: { sessionId, score: 5_000 } })),
  );
  const statuses = res.map((r) => r.status());
  const codes = await Promise.all(res.map(async (r) => (r.status() === 201 ? "OK" : ((await r.json()) as { error: { code: string } }).error.code)));
  no5xx(statuses);
  expect(codes.filter((c) => c === "OK"), codes.join(",")).toHaveLength(1);
  for (const r of res.filter((x) => x.status() === 409)) expect((await r.json()).error.code).toBe("SESSION_ENDED");

  // Lượt không tồn tại / id quá dài / điểm âm / điểm không phải số nguyên
  expect((await api.post(`/api/v1/games/${GAME}/scores`, { data: { sessionId: "nope", score: 1 } })).status()).toBe(404);
  expect((await api.post(`/api/v1/games/${GAME}/scores`, { data: { sessionId: "x".repeat(51), score: 1 } })).status()).toBe(400);
  expect((await api.post(`/api/v1/games/${GAME}/scores`, { data: { sessionId, score: -1 } })).status()).toBe(400);
  expect((await api.post(`/api/v1/games/${GAME}/scores`, { data: { sessionId, score: 1.5 } })).status()).toBe(400);
});

test("track: lô quá lớn bị cắt về 50 sự kiện / 10 thuộc tính, tên sai bị bỏ; body > 64KB → 413", async ({ request }) => {
  const events = Array.from({ length: 120 }, (_, i) => ({
    name: i % 10 === 0 ? "bad name!" : `stress_${i % 5}`,
    props: Object.fromEntries(Array.from({ length: 15 }, (_, k) => [`p${k}`, k === 0 ? "y".repeat(150) : "v"])),
  }));
  const r = await request.post(`/api/v1/games/${GAME}/events`, { data: { events } });
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.accepted + body.dropped).toBeLessThanOrEqual(50);
  expect(body.accepted).toBeGreaterThan(0);

  // ~900KB: chặn ở lớp ngoài, không đọc vào bộ nhớ
  const huge = Array.from({ length: 120 }, () => ({ name: "x", props: { p: "y".repeat(7_500) } }));
  expect((await request.post(`/api/v1/games/${GAME}/events`, { data: { events: huge } })).status()).toBe(413);
});

test("feedback: vượt 5 lần/giờ/IP → 429, không 5xx", async ({ request }) => {
  const statuses: number[] = [];
  for (let i = 0; i < 7; i++) {
    statuses.push((await request.post("/api/v1/feedback", { data: { category: "OTHER", message: `stress ${i} ${Date.now()}` } })).status());
  }
  no5xx(statuses);
  expect(statuses).toContain(429);
  expect(statuses.filter((s) => s === 201).length).toBeLessThanOrEqual(5);
});

test("dồn dập: 150 request đọc song song → chỉ 200 hoặc 429, hub vẫn sống", async ({ request }) => {
  const paths = ["/api/v1/games", `/api/v1/games/${GAME}`, `/api/v1/games/${GAME}/leaderboard`, "/api/v1/status"];
  const res = await Promise.all(Array.from({ length: 150 }, (_, i) => request.get(paths[i % paths.length]).catch(() => null)));
  const statuses = res.map((r) => r?.status() ?? 0);
  no5xx(statuses);
  expect(statuses.filter((s) => s === 0)).toEqual([]); // không rớt kết nối
  expect(statuses.every((s) => s === 200 || s === 429)).toBe(true);
  // 429 phải có Retry-After để client biết chờ bao lâu
  const limited = res.find((r) => r?.status() === 429);
  if (limited) expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
  // Sau cơn dồn dập, health vẫn trả lời (có thể bị chặn tạm thì 429)
  const health = await request.get("/api/v1/health");
  expect([200, 429]).toContain(health.status());
});

test("events: vượt 60 lô/phút/IP → 429 có Retry-After, không 5xx", async ({ request }) => {
  const statuses: number[] = [];
  let retryAfter: string | undefined;
  for (let i = 0; i < 70 && !retryAfter; i++) {
    const r = await request.post(`/api/v1/games/${GAME}/events`, { data: { events: [{ name: "burst" }] } });
    statuses.push(r.status());
    if (r.status() === 429) retryAfter = r.headers()["retry-after"];
  }
  no5xx(statuses);
  expect(statuses).toContain(429);
  expect(Number(retryAfter)).toBeGreaterThan(0);
});
