import { ApiError, handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { requireMyStudio } from "@/modules/developer/service";
import { createToken, listTokens, tokenCreateSchema } from "@/modules/developer/tokens";

/** Token chỉ được quản lý bằng phiên đăng nhập trên web – token không tự tạo / xem token khác */
function rejectBearer(req: Request) {
  if (req.headers.get("authorization")) throw new ApiError(403, "TOKEN_NOT_ALLOWED", "Quản lý token cần đăng nhập trên web");
}

/** Token CLI của tôi (không trả token gốc) */
export async function GET(req: Request) {
  return handle(async () => {
    rejectBearer(req);
    const user = await requireRegisteredUser();
    await requireMyStudio(user.id);
    return ok({ tokens: await listTokens(user.id) });
  });
}

/** Tạo token cho `monlabs deploy` – token gốc chỉ trả về 1 lần */
export async function POST(req: Request) {
  return handle(async () => {
    rejectBearer(req);
    const user = await requireRegisteredUser();
    await requireMyStudio(user.id);
    await rateLimit(`devtoken:${user.id}`, 10, 60 * 60_000);
    const input = tokenCreateSchema.parse(await readJson(req));
    return ok({ token: await createToken(user.id, input) }, { status: 201 });
  });
}
