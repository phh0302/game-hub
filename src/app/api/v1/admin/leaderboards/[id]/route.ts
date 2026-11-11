import { handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminDeleteBoard, adminUpdateBoard, boardUpdateSchema } from "@/modules/scores/boards-admin";

type Ctx = { params: Promise<{ id: string }> };

/** Admin: sửa tên, thời gian, luật điểm của bảng xếp hạng */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    await adminUpdateBoard(id, boardUpdateSchema.parse(await readJson(req)), admin.id);
    return ok({ success: true });
  });
}

/** Admin: xóa bảng xếp hạng (xóa mềm, giữ điểm). Bảng default không xóa được */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    await adminDeleteBoard(id, admin.id);
    return ok({ success: true });
  });
}
