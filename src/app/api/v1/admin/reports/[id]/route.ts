import { handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminResolveReport, reportResolveSchema } from "@/modules/reports/service";

/** Admin xử lý báo cáo. Body: { status: "RESOLVED" | "DISMISSED", resolution? } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const input = reportResolveSchema.parse(await readJson(req));
    return ok({ report: await adminResolveReport(id, input, admin.id) });
  });
}
