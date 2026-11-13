import { ok } from "@/lib/api";
import { resolveServerProject, s1Handle } from "@/modules/platform/server";
import { getProjectPlayer } from "@/modules/platform/server-service";

type Ctx = { params: Promise<{ id: string }> };

/** Server API – người chơi trong game: điểm cao nhất mỗi bảng, số lượt chơi, có bị cấm không */
export async function GET(req: Request, { params }: Ctx) {
  return s1Handle(async () => {
    const ctx = await resolveServerProject(req);
    const { id } = await params;
    return ok(await getProjectPlayer(ctx, id));
  });
}
