import { handle, ok, readJson } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions } from "@/modules/auth/jwt";
import { deleteAccountSchema, deleteUserAccount } from "@/modules/users/account";
import { requireRegisteredUser, requireUser } from "@/modules/auth/session";
import { toPublicUser } from "@/modules/users/dto";
import { updateProfile, updateProfileSchema } from "@/modules/users/service";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok({ user: toPublicUser(user) });
  });
}

/** Cập nhật hồ sơ: { username?, avatarKey? } – username trùng trả lỗi 409 */
export async function PATCH(req: Request) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const input = updateProfileSchema.parse(await readJson(req));
    const updated = await updateProfile(user.id, input);
    return ok({ user: toPublicUser(updated) });
  });
}

/** Xóa hẳn tài khoản của tôi: { confirm: "DELETE" } – không khôi phục được */
export async function DELETE(req: Request) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    deleteAccountSchema.parse(await readJson(req));
    await deleteUserAccount(user.id);
    const res = ok({ deleted: true });
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return res;
  });
}
