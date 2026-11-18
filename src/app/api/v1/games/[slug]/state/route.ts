import { ApiError, handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/modules/auth/session";
import { getSave, putSave } from "@/modules/saves/service";
import { STATE_MAX_BYTES } from "@/lib/game-state";

type Ctx = { params: Promise<{ slug: string }> };

/** Tiến trình game (GameHub.loadState) của người chơi đang đăng nhập → { data: string | null, updatedAt } */
export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { slug } = await params;
    return ok(await getSave(user.id, slug));
  });
}

/** Lưu tiến trình (GameHub.saveState). Body: chuỗi JSON thô (text/plain), tối đa 64KB */
export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    await rateLimit(`state:${user.id}`, 60, 60_000);
    if (Number(req.headers.get("content-length") ?? 0) > STATE_MAX_BYTES) {
      throw new ApiError(413, "STATE_TOO_LARGE", "Dữ liệu tiến trình tối đa 64KB");
    }
    const { slug } = await params;
    return ok(await putSave(user.id, slug, await req.text()));
  });
}
