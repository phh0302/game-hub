import { handle, ok, readJson } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import { requireRegisteredUser } from "@/modules/auth/session";
import { getStudioGame, requireMyStudio, updateStudioGame } from "@/modules/developer/service";
import { devGameUpdateSchema } from "@/modules/developer/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    const { id } = await params;
    return ok({ game: await getStudioGame(studio.id, id, await resolveLocale(req)) });
  });
}

/** Sửa thông tin hiển thị: bản dịch, thể loại, ảnh bìa */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    const { id } = await params;
    const input = devGameUpdateSchema.parse(await readJson(req));
    return ok({ game: await updateStudioGame(studio, user.id, id, input, await resolveLocale(req)) });
  });
}
