import { GameStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { categorySchema } from "@/lib/games";

/** Danh sách game. Lọc theo thể loại: /api/games?category=PUZZLE */
export async function GET(req: Request) {
  return handle(async () => {
    const raw = new URL(req.url).searchParams.get("category");
    const category = raw ? categorySchema.parse(raw.toUpperCase()) : undefined;

    const games = await prisma.game.findMany({
      where: {
        status: { in: [GameStatus.ACTIVE, GameStatus.MAINTENANCE] },
        ...(category ? { category } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return ok({ games });
  });
}
