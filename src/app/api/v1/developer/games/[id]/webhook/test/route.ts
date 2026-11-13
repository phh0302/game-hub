import { handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { requireMyStudio } from "@/modules/developer/service";
import { rateLimit } from "@/lib/rate-limit";
import { sendTestWebhook } from "@/modules/developer/platform";

type Ctx = { params: Promise<{ id: string }> };

/** Gửi thử sự kiện "ping" và trả về kết quả */
export async function POST(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    await rateLimit(`dev-webhook-test:${user.id}`, 20, 60 * 60_000);
    const { id } = await params;
    return ok(await sendTestWebhook(studio, id));
  });
}
