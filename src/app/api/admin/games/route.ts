import { prisma } from "@/lib/prisma";
import { handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { gameCreateSchema } from "@/lib/games";

/** Admin: tất cả game (kể cả game ẩn) */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const games = await prisma.game.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { scores: true } } },
    });
    return ok({ games });
  });
}

/** Admin: thêm game mới */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const data = gameCreateSchema.parse(await readJson(req));
    const game = await prisma.game.create({ data });
    return ok({ game }, { status: 201 });
  });
}
