import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminActivateVersion } from "@/modules/games/service";

/** Đặt phiên bản này làm bản đang chạy (cũng dùng để quay lại bản cũ) */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id, versionId } = await params;
    return ok({ game: await adminActivateVersion(id, versionId) });
  });
}
