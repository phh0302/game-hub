import { handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { requireMyStudio, revokeGameApiKey } from "@/modules/developer/service";

type Ctx = { params: Promise<{ id: string; keyId: string }> };

/** Thu hồi khóa – game dùng khóa này ngừng gọi được API ngay */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    const { id, keyId } = await params;
    await revokeGameApiKey(studio, user.id, id, keyId);
    return ok({ success: true });
  });
}
