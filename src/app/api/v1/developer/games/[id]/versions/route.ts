import { handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { requireMyStudio, submitVersion } from "@/modules/developer/service";
import { devVersionCreateSchema } from "@/modules/developer/schemas";

// Giải nén + lưu bản build có thể mất vài chục giây
export const maxDuration = 60;

/** Gửi bản build đã upload để tạo phiên bản mới (chờ admin duyệt). Body: { version, uploadKey, releaseNotes? } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    rateLimit(`dev-version:${user.id}`, 10, 60 * 60_000);
    const { id } = await params;
    const input = devVersionCreateSchema.parse(await readJson(req));
    return ok({ version: await submitVersion(studio, user.id, id, input) }, { status: 201 });
  });
}
