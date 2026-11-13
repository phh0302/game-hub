import "server-only";
import { GameStatus, type Game } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, clientIp, handle } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { readGameSettings } from "@/modules/games/settings";
import { verifyPlayerToken } from "@/modules/auth/jwt";
import { userWithIdentities, type UserWithIdentities } from "@/modules/users/dto";
import { hashApiKey, looksLikeApiKey } from "./keys";
import { isOriginAllowed, normalizeOrigin, requestOrigin } from "./origins";
import { trackUsage } from "./usage";

export const API_KEY_HEADER = "x-gamehub-key";

/** Cập nhật "lần dùng cuối" của khóa tối đa 10 phút/lần (đỡ ghi DB mỗi request) */
const LAST_USED_INTERVAL_MS = 10 * 60_000;
/** Giới hạn chung cho 1 project – 1 game bị spam không làm chậm project khác */
const PROJECT_LIMIT_PER_MINUTE = 1200;

export type ProjectContext = {
  game: Game & { parsedSettings: ReturnType<typeof readGameSettings> };
  /** Origin đã chuẩn hóa của trang gọi API, vd "https://mygame.io" */
  origin: string;
};

/**
 * Xác định project (game) từ publishable key + kiểm tra domain gọi API.
 * Publishable key là công khai → quyền thật đến từ việc Origin nằm trong danh sách domain đã khai báo.
 */
export async function resolveProject(req: Request): Promise<ProjectContext> {
  const key = req.headers.get(API_KEY_HEADER);
  if (!looksLikeApiKey(key, "PUBLISHABLE")) {
    throw new ApiError(401, "INVALID_API_KEY", "Thiếu hoặc sai publishable key");
  }
  const row = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(key) }, include: { game: true } });
  if (!row || row.kind !== "PUBLISHABLE" || row.revokedAt) {
    throw new ApiError(401, "INVALID_API_KEY", "Publishable key không hợp lệ hoặc đã bị thu hồi");
  }
  const game = row.game;
  if (game.deletedAt || game.status === GameStatus.SUSPENDED || game.status === GameStatus.ARCHIVED) {
    throw new ApiError(403, "PROJECT_DISABLED", "Game này đang bị khóa");
  }
  const origin = requestOrigin(
    { origin: req.headers.get("origin"), secFetchSite: req.headers.get("sec-fetch-site") },
    req.url,
  );
  if (!isOriginAllowed(origin, game.allowedOrigins)) {
    throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "Domain này chưa được khai báo cho game");
  }
  await rateLimit(`p1:${game.id}`, PROJECT_LIMIT_PER_MINUTE, 60_000);
  await trackUsage(game.id, "apiCalls");

  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_INTERVAL_MS) {
    await prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return { game: { ...game, parsedSettings: readGameSettings(game.settings) }, origin: normalizeOrigin(origin!)! };
}

/** Người chơi từ header Authorization: Bearer <token> – token phải thuộc đúng project này */
export async function getPlayer(req: Request, ctx: ProjectContext): Promise<{ user: UserWithIdentities; sid: string } | null> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const payload = await verifyPlayerToken(token);
  if (!payload || payload.gid !== ctx.game.id) return null;
  const row = await prisma.authSession.findUnique({ where: { id: payload.sid }, include: { user: { include: userWithIdentities } } });
  if (!row || row.userId !== payload.sub || row.gameId !== ctx.game.id || row.revokedAt || row.expiresAt <= new Date()) {
    return null;
  }
  if (row.user.deletedAt || row.user.suspendedAt) return null;
  return { user: row.user, sid: row.id };
}

export async function requirePlayer(req: Request, ctx: ProjectContext) {
  const player = await getPlayer(req, ctx);
  if (!player) throw new ApiError(401, "PLAYER_UNAUTHORIZED", "Người chơi chưa đăng nhập hoặc phiên đã hết hạn");
  // Giới hạn theo người chơi (ngoài giới hạn chung của project)
  await rateLimit(`p1u:${player.user.id}`, 120, 60_000);
  return player;
}

/** Giới hạn theo IP cho các thao tác tạo tài khoản / phiên */
export async function rateLimitIp(req: Request, scope: string, limit: number, windowMs: number) {
  await rateLimit(`p1ip:${scope}:${clientIp(req)}`, limit, windowMs);
}

/**
 * CORS cho Client API: API này KHÔNG dùng cookie (chỉ key + token trong header),
 * nên trả lại đúng Origin của trang gọi là an toàn; việc domain có được phép hay không
 * do resolveProject() kiểm tra. Lỗi cũng có CORS để game đọc được mã lỗi.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    ...(origin && origin !== "null" ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": `content-type, authorization, ${API_KEY_HEADER}`,
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/** handle() + CORS cho mọi route /api/p1 */
export async function p1Handle(req: Request, fn: () => Promise<Response>): Promise<Response> {
  const res = await handle(fn);
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function p1Preflight(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
