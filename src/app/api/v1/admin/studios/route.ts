import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminListStudioPlans } from "@/modules/platform/admin-plans";

/** Admin: các studio kèm gói Platform API và mức dùng tháng này */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok({ studios: await adminListStudioPlans() });
  });
}
