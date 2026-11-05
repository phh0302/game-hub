import { handle, ok } from "@/lib/api";
import { getCurrentUser } from "@/modules/auth/session";
import { toPublicUser } from "@/modules/users/dto";

/** User đang đăng nhập, hoặc { user: null } */
export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    return ok({ user: user ? toPublicUser(user) : null });
  });
}
