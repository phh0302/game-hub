import { handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { requireMyStudio } from "@/modules/developer/service";
import { getWebhookConfig, setWebhookUrl, webhookUpdateSchema } from "@/modules/developer/platform";

type Ctx = { params: Promise<{ id: string }> };

/** Cấu hình webhook + 20 lần gửi gần nhất */
export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    const { id } = await params;
    return ok(await getWebhookConfig(studio, id));
  });
}

/** Đặt URL webhook { url } (null = tắt). Lần đầu bật → trả về khóa ký (hiện 1 lần) */
export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    await rateLimit(`dev-webhook:${user.id}`, 30, 60 * 60_000);
    const { id } = await params;
    return ok(await setWebhookUrl(studio, user.id, id, webhookUpdateSchema.parse(await readJson(req))));
  });
}
