import { handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminSetStudioPlan, planUpdateSchema } from "@/modules/platform/admin-plans";

type Ctx = { params: Promise<{ id: string }> };

/** Admin: gán gói { plan, expiresAt?, limits?, note? } */
export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const input = planUpdateSchema.parse(await readJson(req));
    return ok({ summary: await adminSetStudioPlan(id, input, admin.id) });
  });
}
