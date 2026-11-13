import { ok } from "@/lib/api";
import { resolveLocale } from "@/lib/locale";
import { p1Handle, resolveProject } from "@/modules/platform/client";
import { projectInfo } from "@/modules/platform/service";

/** Client API – thông tin project: tên game, các bảng xếp hạng / giải đấu, cách đăng nhập */
export async function GET(req: Request) {
  return p1Handle(req, async () => {
    const ctx = await resolveProject(req);
    return ok({ project: await projectInfo(ctx, await resolveLocale(req)) });
  });
}
