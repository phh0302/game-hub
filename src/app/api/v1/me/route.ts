import { handle, ok, readJson } from "@/lib/api";
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
