import { expect, test } from "@playwright/test";

/** Kiểm tra trạng thái phía máy chủ (uptime 90 ngày cho monlabs.fun/status) */
test("status: chạy kiểm tra (khóa 4 phút), ghi uptime theo ngày, API công khai có CORS", async ({ request }) => {
  const first = await request.post("/api/v1/status/check");
  expect(first.status()).toBe(200);
  const body = (await first.json()) as { ran: boolean; reason?: string; results?: Record<string, { ok: boolean }> };
  if (body.ran) {
    for (const c of ["hub", "api", "platform", "docs", "site"]) expect(body.results?.[c]?.ok, c).toBe(true);
  } else {
    expect(body.reason).toBe("RECENT"); // lần chạy lại (retry) trong 4 phút
  }

  // Gọi lại ngay → không chạy lại (chống bị gọi dồn)
  const again = (await (await request.post("/api/v1/status/check")).json()) as { ran: boolean; reason: string };
  expect(again).toMatchObject({ ran: false, reason: "RECENT" });

  const status = await request.get("/api/v1/status");
  expect(status.headers()["access-control-allow-origin"]).toBe("*");
  const data = (await status.json()) as { last: { results: Record<string, { ok: boolean }> }; days: { date: string; hub?: { ok: number } }[] };
  expect(data.days).toHaveLength(90);
  expect(data.days.at(-1)?.hub?.ok).toBeGreaterThanOrEqual(1);
  expect(data.last.results.api.ok).toBe(true);

  // Dự phòng: GET /api/v1/status khi lần kiểm tra cũ hơn 10 phút sẽ tự chạy kiểm tra (ở đây vừa chạy → không chạy lại)
  const lastAt = data.last ? (data.last as unknown as { at: number }).at : 0;
  const again2 = (await (await request.get("/api/v1/status")).json()) as { last: { at: number } };
  expect(again2.last.at).toBe(lastAt);
});
