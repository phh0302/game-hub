import { handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { createGameApiKey, listGameApiKeys, requireMyStudio } from "@/modules/developer/service";
import { apiKeyCreateSchema } from "@/modules/developer/schemas";

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

/** Tạo khóa mới { kind?: "PUBLISHABLE" | "SECRET" } → { key } hiện đúng 1 lần */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    await rateLimit(`dev-key:${user.id}`, 20, 60 * 60_000);
    const { id } = await params;
    const input = apiKeyCreateSchema.parse(await readJson(req, { optional: true }));
    return ok(await createGameApiKey(studio, user.id, id, input), { status: 201 });
  });
}
