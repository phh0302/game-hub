import { handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { transferOwnership } from "@/modules/developer/service";

/** Chủ studio chuyển quyền chủ sở hữu cho thành viên này */
export async function POST(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const { userId } = await params;
    return ok({ members: await transferOwnership(user.id, userId) });
  });
}
