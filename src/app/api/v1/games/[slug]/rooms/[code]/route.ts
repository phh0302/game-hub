import { ApiError, clientIp, handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/modules/auth/session";
import { getRoom } from "@/modules/rooms/service";
import { isRoomCode } from "@/modules/rooms/rules";

/** Trạng thái phòng (hỏi lại mỗi 1–2 giây). ?since=<seq> → kèm các nước đi mới sau seq đó */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; code: string }> }) {
  return handle(async () => {
    await rateLimit(`room-get:${clientIp(req)}`, 240, 60_000);
    const { slug, code } = await params;
    if (!isRoomCode(code.toUpperCase())) throw new ApiError(404, "ROOM_NOT_FOUND", "Không tìm thấy phòng");
    const since = Number(new URL(req.url).searchParams.get("since"));
    const user = await getCurrentUser();
    return ok({ room: await getRoom(user, slug, code, Number.isInteger(since) && since >= 0 ? since : undefined) });
  });
}
