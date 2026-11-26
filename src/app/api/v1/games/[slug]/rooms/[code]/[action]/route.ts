import { ApiError, handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { joinRoom, leaveRoom, moveRoom, roomMoveSchema, startRoom } from "@/modules/rooms/service";
import { isRoomCode } from "@/modules/rooms/rules";

/** join | leave | start (chủ phòng) | move { data, state?, next?, finish?, seq? } */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string; code: string; action: string }> }) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const { slug, code: raw, action } = await params;
    const code = raw.toUpperCase();
    if (!isRoomCode(code)) throw new ApiError(404, "ROOM_NOT_FOUND", "Không tìm thấy phòng");
    await rateLimit(`room-${action === "move" ? "move" : "act"}:${user.id}`, action === "move" ? 120 : 30, 60_000);
    switch (action) {
      case "join":
        return ok({ room: await joinRoom(user, slug, code) });
      case "leave":
        return ok({ room: await leaveRoom(user, slug, code) });
      case "start":
        return ok({ room: await startRoom(user, slug, code) });
      case "move":
        return ok({ room: await moveRoom(user, slug, code, roomMoveSchema.parse(await readJson(req))) });
      default:
        throw new ApiError(404, "NOT_FOUND", "Không có thao tác này");
    }
  });
}
