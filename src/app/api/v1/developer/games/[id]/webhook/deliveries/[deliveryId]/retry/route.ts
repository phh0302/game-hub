import { handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { requireMyStudio } from "@/modules/developer/service";
import { rateLimit } from "@/lib/rate-limit";
import { retryWebhookDelivery } from "@/modules/developer/platform";

type Ctx = { params: Promise<{ id: string; deliveryId: string }> };

/** Gửi lại ngay 1 sự kiện chưa thành công */
export async function POST(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    await rateLimit(`dev-webhook-test:${user.id}`, 20, 60 * 60_000);
    const { id, deliveryId } = await params;
    return ok(await retryWebhookDelivery(studio, id, deliveryId));
  });
}
