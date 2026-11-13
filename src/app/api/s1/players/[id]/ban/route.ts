import { ok, readJson } from "@/lib/api";
import { resolveServerProject, s1Handle } from "@/modules/platform/server";
import { banPlayer, banSchema, unbanPlayer } from "@/modules/platform/server-service";

type Ctx = { params: Promise<{ id: string }> };

/** Server API – cấm người chơi trong game này: { reason?, deleteScores? } */
export async function PUT(req: Request, { params }: Ctx) {
  return s1Handle(async () => {
    const ctx = await resolveServerProject(req);
    const { id } = await params;
    const input = banSchema.parse(await readJson(req, { optional: true }));
    return ok(await banPlayer(ctx, id, input));
  });
}

/** Server API – bỏ cấm */
export async function DELETE(req: Request, { params }: Ctx) {
  return s1Handle(async () => {
    const ctx = await resolveServerProject(req);
    const { id } = await params;
    return ok(await unbanPlayer(ctx, id));
  });
}
