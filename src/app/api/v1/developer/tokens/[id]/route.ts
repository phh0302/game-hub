import { ApiError, handle, ok } from "@/lib/api";
import { requireRegisteredUser } from "@/modules/auth/session";
import { revokeToken } from "@/modules/developer/tokens";

/** Thu hồi token (có hiệu lực ngay) */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    if (req.headers.get("authorization")) throw new ApiError(403, "TOKEN_NOT_ALLOWED", "Quản lý token cần đăng nhập trên web");
    const user = await requireRegisteredUser();
    const { id } = await params;
    await revokeToken(user.id, id);
    return ok({ revoked: true });
  });
}
