import { prisma } from "@/lib/prisma";
import { handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { adminCreateVersion } from "@/modules/games/service";
import { versionCreateSchema } from "@/modules/games/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const versions = await prisma.gameVersion.findMany({ where: { gameId: id }, orderBy: { createdAt: "desc" } });
    return ok({ versions });
  });
}

/** Thêm phiên bản (file build đã nằm sẵn trong kho lưu trữ tại storageKey) → trạng thái chờ duyệt */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const input = versionCreateSchema.parse(await readJson(req));
    return ok({ version: await adminCreateVersion(id, input, admin.id) }, { status: 201 });
  });
}
