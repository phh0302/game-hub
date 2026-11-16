import { handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { requireMyStudio } from "@/modules/developer/service";
import { quotaSummary } from "@/modules/platform/quota";

/** Gói Platform API của studio + mức dùng tháng này (cảnh báo 80% / 100%) */
export async function GET() {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    return ok(await quotaSummary(studio.id));
  });
}
