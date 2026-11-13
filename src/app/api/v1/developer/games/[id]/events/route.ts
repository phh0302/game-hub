import { handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { listGameAuditEvents, requireMyStudio } from "@/modules/developer/service";
import { devEventsQuerySchema } from "@/modules/developer/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** Nhật ký Platform API của game (?cursor= để tải thêm) */
export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    const { id } = await params;
    const { cursor } = devEventsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return ok(await listGameAuditEvents(studio, id, cursor));
  });
}
