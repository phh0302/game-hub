import { handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminUpdateFeedback, feedbackUpdateSchema } from "@/modules/feedback/service";

/** Admin: đánh dấu góp ý đã xử lý / mở lại. Body: { status: "OPEN" | "DONE" } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const { status } = feedbackUpdateSchema.parse(await readJson(req));
    return ok({ feedback: await adminUpdateFeedback(id, status) });
  });
}
