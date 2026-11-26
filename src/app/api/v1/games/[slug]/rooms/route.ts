import { handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { createRoom, roomCreateSchema } from "@/modules/rooms/service";

/** Tạo phòng chơi theo lượt (người tạo là chủ phòng, ghế 0). Body: { maxPlayers?, turnSeconds?, state? } */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    await rateLimit(`room-create:${user.id}`, 20, 10 * 60_000);
    const { slug } = await params;
    const input = roomCreateSchema.parse((await readJson(req, { optional: true })) ?? {});
    return ok({ room: await createRoom(user, slug, input) }, { status: 201 });
  });
}
