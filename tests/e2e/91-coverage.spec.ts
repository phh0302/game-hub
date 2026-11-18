import { PrismaClient } from "@prisma/client";
import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { installWallet, login, WALLETS } from "./wallet";

/**
 * Các ca trong test plan trước đây "chưa test" vì cần thêm ví / thao tác mạng (chạy bằng ví giả ở CI):
 * PLAY-04 kết nối ví giữa ván · ERR-01 mất mạng lúc nộp điểm · ADM-06 khóa người chơi
 * DEV-01 tạo studio phải đồng ý điều khoản · DEV-11 điều khoản phiên bản mới · DEV-02/03 thành viên, chuyển quyền chủ
 * ACC-05 admin xóa tài khoản theo yêu cầu
 */

async function api<T = unknown>(page: Page, path: string, method = "GET", body?: unknown) {
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
  ) as Promise<{ status: number; data: T & { error?: { code: string } } }>;
}

/** Lật thẻ: lật thẻ đầu (hub mở lượt chơi), gọi beforeFinish, chờ quá 5 giây rồi giải hết */
async function playMemory(page: Page, beforeFinish?: () => Promise<void>) {
  const frame: FrameLocator = page.frameLocator('iframe[title="Lật thẻ"]');
  await expect(frame.locator(".card")).toHaveCount(16);
  const symbols = await frame.locator(".card .front").allTextContents();
  const pairs = new Map<string, number[]>();
  symbols.forEach((s, i) => pairs.set(s, [...(pairs.get(s) ?? []), i]));
  const [first, ...rest] = [...pairs.values()];
  await frame.locator(`.card[data-index="${first![0]}"]`).click();
  if (beforeFinish) await beforeFinish();
  await page.waitForTimeout(6_000);
  await frame.locator(`.card[data-index="${first![1]}"]`).click();
  for (const [a, b] of rest) {
    await frame.locator(`.card[data-index="${a}"]`).click();
    await frame.locator(`.card[data-index="${b}"]`).click();
  }
}

async function boardSize(page: Page) {
  const res = await api<{ entries: unknown[] }>(page, "/games/memory/leaderboard?period=all&limit=100");
  return res.data.entries.length;
}

test("Ca khó test tay: ví giữa ván, mất mạng, khóa người chơi, studio + điều khoản, chuyển quyền, admin xóa tài khoản", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const db = new PrismaClient();
  const ctx = await browser.newContext({ locale: "vi-VN" });
  const p3 = await ctx.newPage();
  await installWallet(p3, "third");
  const third = WALLETS.third.address;

  try {
    // ── PLAY-04: chưa đăng nhập, bắt đầu ván rồi mới kết nối ví → ván đó không lưu ──
    await p3.goto("/games/memory");
    await playMemory(p3, async () => {
      await login(p3, "third");
    });
    await expect(p3.getByRole("status").filter({ hasText: "trước khi kết nối ví" })).toBeVisible();

    // ── ERR-01: mất mạng đúng lúc nộp điểm → báo lỗi, trang không trắng ──
    await p3.reload();
    const session = p3.waitForResponse((r) => r.url().endsWith("/api/v1/games/memory/sessions") && r.ok());
    await playMemory(p3, async () => {
      await session;
      await ctx.setOffline(true);
    });
    await expect(p3.getByRole("alert").filter({ hasText: "Không kết nối được máy chủ" })).toBeVisible();
    await expect(p3.locator('iframe[title="Lật thẻ"]')).toBeVisible();
    await ctx.setOffline(false);

    // Có mạng lại: ván mới được lưu (vế sau của PLAY-04)
    await p3.reload();
    await playMemory(p3);
    await expect(p3.getByRole("status").filter({ hasText: "Kỷ lục mới" })).toBeVisible({ timeout: 15_000 });

    // ── ADM-06: admin khóa người chơi → bị đăng xuất, biến khỏi bảng xếp hạng; mở khóa → hiện lại ──
    await installWallet(page, "admin");
    await page.goto("/");
    await login(page, "admin");
    const before = await boardSize(page);
    await page.goto("/admin");
    const users = page.locator("section", { has: page.getByRole("heading", { name: "Người dùng" }) }).last();
    await users.getByPlaceholder(/Địa chỉ ví/).fill(third);
    await users.getByRole("button", { name: "Tìm" }).click();
    page.once("dialog", (d) => void d.accept("e2e: khóa thử"));
    await users.getByRole("button", { name: "Khóa tài khoản" }).click();
    await expect(users.getByText("Đã khóa", { exact: true })).toBeVisible();
    expect((await api(p3, "/me")).status).toBe(401);
    expect(await boardSize(page)).toBe(before - 1);
    await users.getByRole("button", { name: "Mở khóa" }).click();
    await expect(users.getByText("Đã khóa", { exact: true })).toHaveCount(0);
    expect(await boardSize(page)).toBe(before);

    // ── DEV-01: tạo studio phải tick đồng ý điều khoản ──
    await p3.goto("/");
    await login(p3, "third");
    await p3.goto("/developer");
    const suffix = String(Date.now()).slice(-5);
    await p3.getByLabel("Tên studio").fill(`E2E Third ${suffix}`);
    const createBtn = p3.getByRole("button", { name: "Tạo studio" });
    await expect(createBtn).toBeDisabled();
    expect(
      (await api(p3, "/developer/studio", "POST", { name: "x y", slug: `nope-${suffix}`, acceptTerms: false })).status,
    ).toBe(400);
    await p3.getByRole("checkbox").check();
    await createBtn.click();
    await expect(p3.getByRole("heading", { name: `E2E Third ${suffix}` })).toBeVisible();
    const studioSlug = `e2e-third-${suffix}`;

    // ── DEV-11: điều khoản có phiên bản mới → phải đồng ý lại mới tạo game được ──
    await db.studio.update({ where: { slug: studioSlug }, data: { termsVersion: "2000-01-01" } });
    await p3.reload();
    const accept = p3.getByRole("button", { name: "Tôi đồng ý" });
    await expect(accept).toBeVisible();
    const blocked = await api(p3, "/developer/games", "POST", { slug: `t-${suffix}`, translations: [{ locale: "vi", name: "T" }] });
    expect(blocked.data.error?.code).toBe("TERMS_NOT_ACCEPTED");
    await accept.click();
    await expect(accept).toHaveCount(0);
    const made = await api(p3, "/developer/games", "POST", { slug: `t-${suffix}`, translations: [{ locale: "vi", name: "T" }] });
    expect(made.status).toBe(201);

    // ── DEV-02 / DEV-03: thêm ví người chơi, chủ không rời được, chuyển quyền rồi rời ──
    const added = await api(p3, "/developer/studio/members", "POST", { walletAddress: WALLETS.player.address });
    expect([200, 201]).toContain(added.status);
    const members = await api<{ members: { userId: string; role: string; walletAddress: string | null }[] }>(
      p3,
      "/developer/studio/members",
    );
    const me = members.data.members.find((m) => m.role === "OWNER")!;
    const player = members.data.members.find((m) => m.walletAddress?.toLowerCase() === WALLETS.player.address.toLowerCase())!;
    expect(player).toBeTruthy();
    expect((await api(p3, `/developer/studio/members/${me.userId}`, "DELETE")).data.error?.code).toBe("OWNER_CANNOT_LEAVE");
    expect((await api(p3, `/developer/studio/members/${player.userId}/owner`, "POST")).status).toBe(200);
    expect((await api(p3, `/developer/studio/members/${me.userId}`, "DELETE")).status).toBe(200);
    expect((await api<{ studio: unknown }>(p3, "/developer/studio")).data.studio).toBeNull();

    // ── ACC-05: admin xóa tài khoản theo yêu cầu (xác nhận ngay trên trang) ──
    await users.getByPlaceholder(/Địa chỉ ví/).fill(third);
    await users.getByRole("button", { name: "Tìm" }).click();
    await users.getByRole("button", { name: "Xóa tài khoản…" }).click();
    await users.getByRole("button", { name: "Xóa vĩnh viễn" }).click();
    await expect(users.getByText(/Đã xóa tài khoản/)).toBeVisible();
    expect((await api(p3, "/me")).status).toBe(401);
  } finally {
    await ctx.close();
    await db.$disconnect();
  }
});
