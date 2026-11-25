import { handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { autoCoverFromBuild, requireMyStudio } from "@/modules/developer/service";

/** Game chưa có ảnh bìa → lấy cover.png / og-image.png… trong bản build đang chạy (hoặc mới nhất) */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    const { id } = await params;
    return ok({ cover: await autoCoverFromBuild(studio, user.id, id) });
  });
}
