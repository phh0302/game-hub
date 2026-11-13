import { handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { createGameApiKey, listGameApiKeys, requireMyStudio } from "@/modules/developer/service";

type Ctx = { params: Promise<{ id: string }> };

/** Platform API: danh sách khóa của game (chỉ phần đầu, không lộ khóa đầy đủ) */
export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    const { id } = await params;
    return ok({ keys: await listGameApiKeys(studio, id) });
  });
}

/** Tạo publishable key mới → { key } hiện đúng 1 lần */
export async function POST(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    await rateLimit(`dev-key:${user.id}`, 20, 60 * 60_000);
    const { id } = await params;
    return ok(await createGameApiKey(studio, user.id, id), { status: 201 });
  });
}
