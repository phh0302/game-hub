import { handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { requireMyStudio } from "@/modules/developer/service";
import { rotateWebhookSecret } from "@/modules/developer/platform";

type Ctx = { params: Promise<{ id: string }> };

/** Đổi khóa ký webhook → khóa mới hiện 1 lần; khóa cũ hết hiệu lực ngay */
export async function POST(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    const { id } = await params;
    return ok(await rotateWebhookSecret(studio, user.id, id));
  });
}
