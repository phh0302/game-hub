import { handle, ok } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import { requireUser } from "@/modules/auth/session";
import { getMyScores } from "@/modules/users/service";

/** Thành tích của user: điểm tốt nhất từng bảng xếp hạng + 20 lượt gần nhất */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    return ok(await getMyScores(user.id, await resolveLocale(req)));
  });
}
