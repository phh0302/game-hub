import { handle, ok } from "@/lib/api";
import { getCurrentUser, toPublicUser } from "@/lib/auth/session";

/** User đang đăng nhập, hoặc { user: null } */
export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    return ok({ user: user ? toPublicUser(user) : null });
  });
}
