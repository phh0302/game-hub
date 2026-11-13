import { handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { requireMyStudio } from "@/modules/developer/service";
import { getGameUsage, usageQuerySchema } from "@/modules/developer/platform";

type Ctx = { params: Promise<{ id: string }> };

/** Số liệu dùng theo ngày (?days=7|30|90) */
export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    const { id } = await params;
    const { days } = usageQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return ok(await getGameUsage(studio, id, days));
  });
}
