import "server-only";
import { GameStatus, type Game } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, handle } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { readGameSettings } from "@/modules/games/settings";
import { hashApiKey, looksLikeApiKey } from "./keys";
import { trackUsage } from "./usage";

/**
 * Server API (/api/s1): máy chủ của game gọi bằng secret key trong header
 * `Authorization: Bearer sk_live_…`. KHÔNG có CORS → trình duyệt không đọc được kết quả;
 * secret key không bao giờ được đưa vào code chạy trên trình duyệt.
 */

const LAST_USED_INTERVAL_MS = 10 * 60_000;
const SERVER_LIMIT_PER_MINUTE = 600;

export type ServerContext = { game: Game & { parsedSettings: ReturnType<typeof readGameSettings> } };

export async function resolveServerProject(req: Request): Promise<ServerContext> {
  const header = req.headers.get("authorization");
  const key = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!looksLikeApiKey(key, "SECRET")) {
    throw new ApiError(401, "INVALID_SECRET_KEY", "Thiếu hoặc sai secret key (Authorization: Bearer sk_live_…)");
  }
  const row = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(key) }, include: { game: true } });
  if (!row || row.kind !== "SECRET" || row.revokedAt) {
    throw new ApiError(401, "INVALID_SECRET_KEY", "Secret key không hợp lệ hoặc đã bị thu hồi");
  }
  const game = row.game;
  if (game.deletedAt || game.status === GameStatus.SUSPENDED || game.status === GameStatus.ARCHIVED) {
    throw new ApiError(403, "PROJECT_DISABLED", "Game này đang bị khóa");
  }
  await rateLimit(`s1:${game.id}`, SERVER_LIMIT_PER_MINUTE, 60_000);
  await trackUsage(game.id, "apiCalls");
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_INTERVAL_MS) {
    await prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return { game: { ...game, parsedSettings: readGameSettings(game.settings) } };
}

/** handle() cho mọi route /api/s1 – không cache */
export async function s1Handle(fn: () => Promise<Response>): Promise<Response> {
  const res = await handle(fn);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
