import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminListFeedback, feedbackListQuerySchema } from "@/modules/feedback/service";

/** Admin: góp ý theo trạng thái (?status=OPEN|DONE) + số lượng */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { status } = feedbackListQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return ok(await adminListFeedback(status));
  });
}
