import { handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { acceptTerms } from "@/modules/developer/service";

/** Chủ studio đồng ý Điều khoản người đăng game phiên bản hiện tại */
export async function POST() {
  return handle(async () => {
    const user = await requireRegisteredUser();
    return ok({ studio: await acceptTerms(user.id) });
  });
}
