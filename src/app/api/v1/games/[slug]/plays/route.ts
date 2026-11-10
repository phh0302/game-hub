import { clientIp, handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getPlayableGame } from "@/modules/games/service";
import { logEvent } from "@/modules/events/service";

/**
 * Ghi 1 lượt chơi của người CHƯA kết nối ví (người đã đăng nhập được tính qua GameSession).
 * Không lưu IP hay thông tin cá nhân – chỉ đếm lượt chơi theo game để thống kê / chia doanh thu sau này.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    await rateLimit(`play:${clientIp(req)}`, 60, 60 * 60_000);
    const { slug } = await params;
    const game = await getPlayableGame(slug);
    await logEvent({ type: "play.anonymous", gameId: game.id });
    return ok({ counted: true }, { status: 201 });
  });
}
