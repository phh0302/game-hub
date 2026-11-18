import { handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { activateStudioVersion, requireMyStudio } from "@/modules/developer/service";

type Ctx = { params: Promise<{ id: string; versionId: string }> };

/** Developer đặt 1 phiên bản đã duyệt làm bản đang chạy (rollback / đưa bản cập nhật lên) */
export async function POST(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    await rateLimit(`dev-activate:${user.id}`, 30, 60 * 60_000);
    const { id, versionId } = await params;
    return ok(await activateStudioVersion(studio, user.id, id, versionId));
  });
}
