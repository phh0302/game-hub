import { prisma } from "@/lib/prisma";
import { handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { gameUpdateSchema } from "@/lib/games";

type Ctx = { params: Promise<{ id: string }> };

/** Admin: sửa game */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const data = gameUpdateSchema.parse(await readJson(req));
    const game = await prisma.game.update({ where: { id }, data });
    return ok({ game });
  });
}

/**
 * Admin: xóa game – XÓA LUÔN toàn bộ lượt chơi và điểm của game.
 * Muốn giữ lại dữ liệu thì dùng PATCH { status: "HIDDEN" } thay vì xóa.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    await prisma.game.delete({ where: { id } });
    return ok({ success: true });
  });
}
