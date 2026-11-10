import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminFindUser, userLookupSchema } from "@/modules/users/moderation";

/** Admin: tìm người dùng theo ví hoặc tên. GET ?q=0x… | username */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { q } = userLookupSchema.parse({ q: new URL(req.url).searchParams.get("q") ?? "" });
    return ok({ user: await adminFindUser(q) });
  });
}
