import { handle, ok } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import { requireAdmin } from "@/modules/auth/session";
import { adminListReports, reportListQuerySchema } from "@/modules/reports/service";

/** Admin: báo cáo vi phạm theo trạng thái (?status=OPEN|RESOLVED|DISMISSED) + số lượng từng trạng thái */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { status } = reportListQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return ok(await adminListReports(status, await resolveLocale(req)));
  });
}
