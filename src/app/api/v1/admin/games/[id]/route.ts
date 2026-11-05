import { handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminArchiveGame, adminUpdateGame } from "@/modules/games/service";
import { gameUpdateSchema } from "@/modules/games/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** Admin: sửa game (bản dịch gửi lên sẽ ghi đè theo từng ngôn ngữ) */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const input = gameUpdateSchema.parse(await readJson(req));
    return ok({ game: await adminUpdateGame(id, input) });
  });
}

/** Admin: lưu trữ game (không xóa cứng – điểm và lịch sử vẫn còn) */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    await adminArchiveGame(id);
    return ok({ success: true });
  });
}
