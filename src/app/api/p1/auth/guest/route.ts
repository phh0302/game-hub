import { ok } from "@/lib/api";
import { p1Handle, rateLimitIp, resolveProject } from "@/modules/platform/client";
import { createGuestPlayer } from "@/modules/platform/service";

/** Client API – chơi khách (không cần ví): tạo tài khoản khách → { token, player } */
export async function POST(req: Request) {
  return p1Handle(req, async () => {
    const ctx = await resolveProject(req);
    // Chặn tạo hàng loạt tài khoản khách để chiếm bảng xếp hạng
    await rateLimitIp(req, "guest", 10, 60 * 60_000);
    return ok(await createGuestPlayer(req, ctx), { status: 201 });
  });
}
