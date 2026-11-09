import { handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { createReport, reportCreateSchema } from "@/modules/reports/service";

/** Báo cáo vi phạm. Body: { reason: "BROKEN" | "INAPPROPRIATE" | "COPYRIGHT" | "CHEATING" | "OTHER", message? } */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    rateLimit(`report:${user.id}`, 10, 60 * 60_000);
    const { slug } = await params;
    const input = reportCreateSchema.parse(await readJson(req));
    return ok({ report: await createReport(user.id, slug, input) }, { status: 201 });
  });
}
