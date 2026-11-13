import { ok } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import { resolveServerProject, s1Handle } from "@/modules/platform/server";
import { serverProjectInfo } from "@/modules/platform/server-service";

/** Server API – thông tin project của secret key (kiểm tra key, xem chế độ nộp điểm, các bảng xếp hạng) */
export async function GET(req: Request) {
  return s1Handle(async () => {
    const ctx = await resolveServerProject(req);
    return ok({ project: await serverProjectInfo(ctx, await resolveLocale(req)) });
  });
}
