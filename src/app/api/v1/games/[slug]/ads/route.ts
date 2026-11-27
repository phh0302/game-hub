import { ApiError, clientIp, handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { AD_STATUSES, adEventName, type AdKind, type AdStatus } from "@/lib/ads/config";
import { getVisibleGame } from "@/modules/games/service";
import { recordGameEvents } from "@/modules/analytics/events";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * Hub ghi nhận một lượt quảng cáo của game (để chia doanh thu cho developer sau này).
 * Body: { kind: "rewarded" | "interstitial", status: "viewed" | "dismissed" | "nofill" | "error" }
 * Đếm theo ngày trong cùng kho sự kiện game với tên hub.ad.<kind>.<status> (game không tự gửi được tiền tố hub.).
 */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    await rateLimit(`ads:${clientIp(req)}`, 30, 60_000);
    const { slug } = await params;
    const body = (await readJson(req)) as { kind?: unknown; status?: unknown } | null;
    const kind = body?.kind;
    const status = body?.status;
    if ((kind !== "rewarded" && kind !== "interstitial") || !AD_STATUSES.includes(status as AdStatus)) {
      throw new ApiError(400, "INVALID_INPUT", "kind / status không hợp lệ");
    }
    const game = await getVisibleGame(slug);
    return ok(await recordGameEvents(game.id, [{ name: adEventName(kind as AdKind, status as AdStatus) }], "hub"));
  });
}
