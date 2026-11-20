import { ok, readJson } from "@/lib/api";
import { p1Handle, requirePlayer, resolveProject } from "@/modules/platform/client";
import { getSaveForGame, putSaveForGame } from "@/modules/saves/service";

/** Client API – tiến trình đã lưu của người chơi (GameHub.loadState ở chế độ độc lập) → { data: string | null } */
export async function GET(req: Request) {
  return p1Handle(req, async () => {
    const ctx = await resolveProject(req);
    const { user } = await requirePlayer(req, ctx);
    return ok(await getSaveForGame(user.id, ctx.game.id));
  });
}

/** Client API – lưu tiến trình (GameHub.saveState). Body: { data: "<chuỗi JSON ≤ 64KB>" }. Dùng chung với bản trên hub */
export async function POST(req: Request) {
  return p1Handle(req, async () => {
    const ctx = await resolveProject(req);
    const { user } = await requirePlayer(req, ctx);
    const body = (await readJson(req, { maxBytes: 256 * 1024 })) as { data?: unknown } | null;
    return ok(await putSaveForGame(user.id, ctx.game.id, body?.data));
  });
}
