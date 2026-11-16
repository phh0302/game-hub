import { handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminSetSuspended, userSuspendSchema } from "@/modules/users/moderation";
import { deleteUserAccount } from "@/modules/users/account";

/** Admin: khóa / mở khóa tài khoản. Body: { suspended, reason? } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const input = userSuspendSchema.parse(await readJson(req));
    return ok({ user: await adminSetSuspended(admin.id, id, input) });
  });
}

/** Admin: xóa hẳn tài khoản theo yêu cầu của người chơi (không khôi phục được) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    return ok(await deleteUserAccount(id, { byAdminId: admin.id }));
  });
}
