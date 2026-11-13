import { ok } from "@/lib/api";
import { resolveServerProject, s1Handle } from "@/modules/platform/server";
import { deleteScore } from "@/modules/platform/server-service";

type Ctx = { params: Promise<{ id: string }> };

/** Server API – xóa điểm gian lận (cả điểm đã ghi vào giải đấu của cùng lượt chơi). ?reason= ghi vào nhật ký */
export async function DELETE(req: Request, { params }: Ctx) {
  return s1Handle(async () => {
    const ctx = await resolveServerProject(req);
    const { id } = await params;
    const reason = new URL(req.url).searchParams.get("reason")?.slice(0, 300) || undefined;
    return ok(await deleteScore(ctx, id, reason));
  });
}
