import { handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminCreateBoard, adminListBoards, boardCreateSchema } from "@/modules/scores/boards-admin";

type Ctx = { params: Promise<{ id: string }> };

/** Admin: danh sách bảng xếp hạng của game (kèm số điểm, số người chơi) */
export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    return ok({ leaderboards: await adminListBoards(id) });
  });
}

/** Admin: tạo bảng xếp hạng / giải đấu mới */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const input = boardCreateSchema.parse(await readJson(req));
    await adminCreateBoard(id, input, admin.id);
    return ok({ leaderboards: await adminListBoards(id) }, { status: 201 });
  });
}
