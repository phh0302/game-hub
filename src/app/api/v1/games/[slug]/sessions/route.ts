import { handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { startSession } from "@/modules/scores/service";

/** Bắt đầu 1 lượt chơi → { sessionId } dùng để nộp điểm khi kết thúc */
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    await rateLimit(`session:${user.id}`, 30, 60_000);
    const { slug } = await params;
    return ok(await startSession(user.id, slug), { status: 201 });
  });
}
