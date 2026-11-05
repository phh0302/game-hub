import { handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminReviewVersion } from "@/modules/games/service";
import { versionReviewSchema } from "@/modules/games/schemas";

/** Duyệt / từ chối phiên bản. Body: { status: "APPROVED" | "REJECTED", reviewNote? } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id, versionId } = await params;
    const input = versionReviewSchema.parse(await readJson(req));
    return ok({ version: await adminReviewVersion(id, versionId, input, admin.id) });
  });
}
