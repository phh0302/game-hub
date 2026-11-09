import { handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { removeMember } from "@/modules/developer/service";

/** Chủ studio bỏ thành viên, hoặc thành viên tự rời studio (userId = chính mình) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const { userId } = await params;
    return ok({ members: await removeMember(user.id, userId) });
  });
}
