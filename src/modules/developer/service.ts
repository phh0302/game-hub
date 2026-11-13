import "server-only";
import { randomUUID } from "node:crypto";
import { GameStatus, Prisma, type Studio } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { assetUrl } from "@/lib/assets";
import { pickTranslation } from "@/lib/locale";
import { logEvent } from "@/modules/events/service";
import { adminCreateGame, adminUpdateGame } from "@/modules/games/service";
import { storage } from "@/modules/storage";
import { buildDir, imageKey, incomingZipKey, isImageKeyOf, isIncomingKeyOf } from "@/modules/storage/keys";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_UPLOAD_BYTES } from "@/modules/uploads/limits";
import { extractBuild, ZipValidationError, type BuildFile } from "@/modules/uploads/zip";
import { displayName } from "@/lib/format";
import { primaryWallet } from "@/modules/users/dto";
import { generateApiKey } from "@/modules/platform/keys";
import { normalizeOrigin } from "@/modules/platform/origins";
import { readGameSettings } from "@/modules/games/settings";
import { DEVELOPER_TERMS_VERSION, isTermsUpToDate } from "./terms";
import type {
  ApiKeyCreateInput,
  MemberAddInput,
  DevGameCreateInput,
  DevGameUpdateInput,
  DevVersionCreateInput,
  StudioCreateInput,
  UploadRequestInput,
} from "./schemas";

/** Windows/Chrome báo .zip là "application/x-zip-compressed", macOS là "application/zip" */
const ZIP_TYPES = new Set(["application/zip", "application/x-zip-compressed", "application/octet-stream"]);
const UPLOAD_LINK_SECONDS = 15 * 60;

// ───────────── Studio ─────────────

/** Studio của user (bản đầu: mỗi user thuộc tối đa 1 studio) */
export async function getMyStudio(userId: string) {
  const member = await prisma.studioMember.findFirst({
    where: { userId, studio: { deletedAt: null } },
    include: { studio: true },
    orderBy: { createdAt: "asc" },
  });
  return member ? { ...member.studio, myRole: member.role, termsUpToDate: isTermsUpToDate(member.studio) } : null;
}

type MyStudio = NonNullable<Awaited<ReturnType<typeof getMyStudio>>>;

/** Chặn tạo game / upload khi studio chưa đồng ý điều khoản phiên bản hiện tại */
export function assertTermsAccepted(studio: { termsVersion: string | null }) {
  if (!isTermsUpToDate(studio)) {
    throw new ApiError(403, "TERMS_NOT_ACCEPTED", "Studio cần đồng ý điều khoản người đăng game phiên bản mới");
  }
}

function assertOwner(studio: MyStudio) {
  if (studio.myRole !== "OWNER") throw new ApiError(403, "OWNER_ONLY", "Chỉ chủ studio được làm việc này");
}

/** Chủ studio đồng ý điều khoản phiên bản hiện tại */
export async function acceptTerms(userId: string) {
  const studio = await requireMyStudio(userId);
  assertOwner(studio);
  await prisma.studio.update({
    where: { id: studio.id },
    data: { termsVersion: DEVELOPER_TERMS_VERSION, termsAcceptedAt: new Date(), termsAcceptedById: userId },
  });
  await logEvent({ type: "studio.terms", userId, data: { studioId: studio.id, version: DEVELOPER_TERMS_VERSION } });
  return getMyStudio(userId);
}

// ───────────── Thành viên studio ─────────────

const MAX_MEMBERS = 20;

export async function listMembers(studioId: string) {
  const members = await prisma.studioMember.findMany({
    where: { studioId },
    include: { user: { include: { identities: true } } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  return members.map((m) => {
    const wallet = primaryWallet(m.user);
    return {
      userId: m.userId,
      role: m.role,
      joinedAt: m.createdAt,
      walletAddress: wallet,
      displayName: displayName({ id: m.user.id, username: m.user.username, walletAddress: wallet }),
    };
  });
}

/** Chủ studio thêm thành viên bằng địa chỉ ví (người đó phải từng đăng nhập Game Hub) */
export async function addMember(userId: string, input: MemberAddInput) {
  const studio = await requireMyStudio(userId);
  assertOwner(studio);

  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerUserId: { provider: "WALLET", providerUserId: input.walletAddress.toLowerCase() } },
    include: { user: true },
  });
  if (!identity || identity.user.deletedAt) {
    throw new ApiError(404, "USER_NOT_FOUND", "Ví này chưa từng đăng nhập Game Hub");
  }
  if (await getMyStudio(identity.userId)) {
    throw new ApiError(409, "ALREADY_IN_STUDIO", "Người này đã thuộc một studio");
  }
  if ((await prisma.studioMember.count({ where: { studioId: studio.id } })) >= MAX_MEMBERS) {
    throw new ApiError(409, "STUDIO_FULL", `Studio tối đa ${MAX_MEMBERS} thành viên`);
  }

  await prisma.studioMember.create({ data: { studioId: studio.id, userId: identity.userId, role: "MEMBER" } });
  await logEvent({ type: "studio.member.add", userId, data: { studioId: studio.id, memberId: identity.userId } });
  return listMembers(studio.id);
}

/** Chủ studio bỏ thành viên, hoặc thành viên tự rời studio */
export async function removeMember(userId: string, targetUserId: string) {
  const studio = await requireMyStudio(userId);
  const target = await prisma.studioMember.findUnique({
    where: { studioId_userId: { studioId: studio.id, userId: targetUserId } },
  });
  if (!target) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy thành viên");
  if (target.role === "OWNER") {
    throw new ApiError(400, "OWNER_CANNOT_LEAVE", "Chủ studio cần chuyển quyền cho người khác trước khi rời");
  }
  if (targetUserId !== userId) assertOwner(studio);

  await prisma.studioMember.delete({ where: { studioId_userId: { studioId: studio.id, userId: targetUserId } } });
  await logEvent({ type: "studio.member.remove", userId, data: { studioId: studio.id, memberId: targetUserId } });
  return listMembers(studio.id);
}

/** Chủ studio chuyển quyền chủ sở hữu cho 1 thành viên (mình thành thành viên thường) */
export async function transferOwnership(userId: string, targetUserId: string) {
  const studio = await requireMyStudio(userId);
  assertOwner(studio);
  if (targetUserId === userId) throw new ApiError(400, "VALIDATION_ERROR", "Bạn đã là chủ studio");
  const target = await prisma.studioMember.findUnique({
    where: { studioId_userId: { studioId: studio.id, userId: targetUserId } },
  });
  if (!target) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy thành viên");

  await prisma.$transaction([
    prisma.studioMember.update({ where: { studioId_userId: { studioId: studio.id, userId: targetUserId } }, data: { role: "OWNER" } }),
    prisma.studioMember.update({ where: { studioId_userId: { studioId: studio.id, userId } }, data: { role: "MEMBER" } }),
  ]);
  await logEvent({ type: "studio.owner.transfer", userId, data: { studioId: studio.id, newOwnerId: targetUserId } });
  return listMembers(studio.id);
}

export async function requireMyStudio(userId: string) {
  const studio = await getMyStudio(userId);
  if (!studio) throw new ApiError(403, "NOT_DEVELOPER", "Bạn cần đăng ký làm developer trước");
  return studio;
}

export async function createStudio(userId: string, input: StudioCreateInput) {
  if (await getMyStudio(userId)) throw new ApiError(409, "ALREADY_DEVELOPER", "Bạn đã có studio");
  if (input.slug === "game-hub") throw new ApiError(409, "CONFLICT", "Tên này đã được dùng");

  const studio = await prisma.studio.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      termsVersion: DEVELOPER_TERMS_VERSION,
      termsAcceptedAt: new Date(),
      termsAcceptedById: userId,
      members: { create: { userId, role: "OWNER" } },
    },
  });
  await logEvent({ type: "studio.create", userId, data: { studioId: studio.id, slug: studio.slug } });
  return studio;
}

// ───────────── Game của studio ─────────────

const devGameInclude = {
  translations: true,
  categories: { include: { category: true } },
  versions: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.GameInclude;

type DevGame = Prisma.GameGetPayload<{ include: typeof devGameInclude }>;

function toDevGameDto(game: DevGame, locale: string, stats?: { sessions: number; players: number; scores: number }) {
  return {
    id: game.id,
    slug: game.slug,
    status: game.status,
    name: pickTranslation(game.translations, locale)?.name ?? game.slug,
    translations: game.translations.map((t) => ({ locale: t.locale, name: t.name, description: t.description })),
    categorySlugs: game.categories.map((c) => c.category.slug),
    thumbnailKey: game.thumbnailKey,
    thumbnailUrl: assetUrl(game.thumbnailKey),
    currentVersionId: game.currentVersionId,
    publishedAt: game.publishedAt,
    allowedOrigins: game.allowedOrigins,
    scoreSubmission: readGameSettings(game.settings).scoreSubmission,
    versions: game.versions.map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      reviewNote: v.reviewNote,
      releaseNotes: v.releaseNotes,
      sizeBytes: v.sizeBytes,
      createdAt: v.createdAt,
      isCurrent: v.id === game.currentVersionId,
    })),
    stats: stats ?? { sessions: 0, players: 0, scores: 0 },
  };
}

async function gameStats(gameIds: string[]) {
  const stats = new Map<string, { sessions: number; players: number; scores: number }>();
  if (gameIds.length === 0) return stats;
  const [sessions, scores, players] = await Promise.all([
    prisma.gameSession.groupBy({ by: ["gameId"], where: { gameId: { in: gameIds } }, _count: { _all: true } }),
    prisma.score.groupBy({ by: ["gameId"], where: { gameId: { in: gameIds } }, _count: { _all: true } }),
    prisma.$queryRaw<{ gameId: string; players: number }[]>`
      SELECT "gameId", COUNT(DISTINCT "userId")::int AS players
      FROM "GameSession" WHERE "gameId" IN (${Prisma.join(gameIds)})
      GROUP BY "gameId"
    `,
  ]);
  for (const id of gameIds) stats.set(id, { sessions: 0, players: 0, scores: 0 });
  sessions.forEach((s) => (stats.get(s.gameId)!.sessions = s._count._all));
  scores.forEach((s) => (stats.get(s.gameId)!.scores = s._count._all));
  players.forEach((p) => (stats.get(p.gameId)!.players = p.players));
  return stats;
}

export async function listStudioGames(studioId: string, locale: string) {
  const games = await prisma.game.findMany({
    where: { studioId, deletedAt: null },
    include: devGameInclude,
    orderBy: { createdAt: "desc" },
  });
  const stats = await gameStats(games.map((g) => g.id));
  return games.map((g) => toDevGameDto(g, locale, stats.get(g.id)));
}

async function findStudioGame(studioId: string, gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId }, include: devGameInclude });
  if (!game || game.deletedAt || game.studioId !== studioId) {
    throw new ApiError(404, "GAME_NOT_FOUND", "Không tìm thấy game");
  }
  return game;
}

export async function getStudioGame(studioId: string, gameId: string, locale: string) {
  const game = await findStudioGame(studioId, gameId);
  const stats = await gameStats([game.id]);
  return toDevGameDto(game, locale, stats.get(game.id));
}

function assertOwnImage(thumbnailKey: string | null | undefined, userId: string) {
  if (thumbnailKey && !isImageKeyOf(thumbnailKey, userId)) {
    throw new ApiError(400, "IMAGE_KEY_INVALID", "Ảnh bìa không hợp lệ – hãy upload lại");
  }
}

export async function createStudioGame(studio: Studio, userId: string, input: DevGameCreateInput, locale: string) {
  assertTermsAccepted(studio);
  assertOwnImage(input.thumbnailKey, userId);
  const created = await adminCreateGame({
    slug: input.slug,
    studioId: studio.id,
    status: GameStatus.DRAFT,
    translations: input.translations,
    categorySlugs: input.categorySlugs,
    thumbnailKey: input.thumbnailKey ?? null,
  });
  await logEvent({ type: "game.create", userId, gameId: created.id, data: { studioId: studio.id } });
  return getStudioGame(studio.id, created.id, locale);
}

export async function updateStudioGame(
  studio: Studio,
  userId: string,
  gameId: string,
  input: DevGameUpdateInput,
  locale: string,
) {
  const game = await findStudioGame(studio.id, gameId);
  // Giữ ảnh cũ thì không cần kiểm tra lại quyền sở hữu
  if (input.thumbnailKey !== game.thumbnailKey) assertOwnImage(input.thumbnailKey, userId);
  await adminUpdateGame(game.id, {
    translations: input.translations,
    categorySlugs: input.categorySlugs,
    thumbnailKey: input.thumbnailKey,
  });
  if (input.allowedOrigins) {
    const origins = [...new Set(input.allowedOrigins.filter((o) => o.trim()).map((o) => normalizeOrigin(o)))];
    if (origins.some((o) => o === null)) {
      throw new ApiError(400, "INVALID_ORIGIN", "Domain không hợp lệ (dạng https://ten-mien.com, http chỉ cho localhost)");
    }
    await prisma.game.update({ where: { id: game.id }, data: { allowedOrigins: origins as string[] } });
    await logEvent({ type: "platform.origins", userId, gameId: game.id, data: { origins: origins as string[] } });
  }
  if (input.scoreSubmission && input.scoreSubmission !== readGameSettings(game.settings).scoreSubmission) {
    // Đọc lại settings mới nhất rồi chỉ đổi 1 key (giữ các luật admin đã đặt)
    const fresh = await prisma.game.findUniqueOrThrow({ where: { id: game.id }, select: { settings: true } });
    const settings = { ...((fresh.settings as Record<string, unknown>) ?? {}), scoreSubmission: input.scoreSubmission };
    await prisma.game.update({ where: { id: game.id }, data: { settings: settings as Prisma.InputJsonObject } });
    await logEvent({ type: "platform.scoring", userId, gameId: game.id, data: { scoreSubmission: input.scoreSubmission } });
  }
  return getStudioGame(studio.id, game.id, locale);
}

// ───────────── Upload ─────────────

/** Cấp link upload thẳng lên kho lưu trữ (file không đi qua server web) */
export async function createUploadTicket(userId: string, input: UploadRequestInput) {
  // Vercel không ghi được đĩa → bắt buộc cấu hình kho S3/R2 (docs/DEPLOY.md mục 3b).
  // Dựa vào biến VERCEL (Vercel tự đặt) thay vì NODE_ENV: máy dev có thể bị đặt NODE_ENV=production ở cấp hệ thống.
  if (process.env.VERCEL && storage().name === "local" && process.env.ALLOW_LOCAL_STORAGE !== "1") {
    throw new ApiError(503, "UPLOADS_NOT_CONFIGURED", "Chức năng upload chưa được cấu hình kho lưu trữ");
  }
  const id = randomUUID();
  if (input.kind === "build") {
    if (!ZIP_TYPES.has(input.contentType)) throw new ApiError(400, "UPLOAD_TYPE_NOT_ALLOWED", "Chỉ nhận file .zip");
    if (input.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "FILE_TOO_LARGE", "File .zip tối đa 50MB");
    return storage().createUploadTicket(incomingZipKey(userId, id), input.contentType, UPLOAD_LINK_SECONDS);
  }
  const ext = IMAGE_TYPES[input.contentType];
  if (!ext) throw new ApiError(400, "UPLOAD_TYPE_NOT_ALLOWED", "Ảnh chỉ nhận PNG, JPG, WEBP");
  if (input.size > MAX_IMAGE_BYTES) throw new ApiError(413, "FILE_TOO_LARGE", "Ảnh tối đa 1MB");
  return storage().createUploadTicket(imageKey(userId, id, ext), input.contentType, UPLOAD_LINK_SECONDS);
}

/** Chạy tối đa `limit` tác vụ cùng lúc */
async function inBatches<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(task));
  }
}

/**
 * Nhận bản build: tải .zip từ kho → kiểm tra + giải nén → lưu từng file → tạo phiên bản chờ duyệt.
 */
export async function submitVersion(studio: Studio, userId: string, gameId: string, input: DevVersionCreateInput) {
  assertTermsAccepted(studio);
  const game = await findStudioGame(studio.id, gameId);

  if (!isIncomingKeyOf(input.uploadKey, userId)) {
    throw new ApiError(400, "UPLOAD_KEY_INVALID", "File upload không hợp lệ – hãy upload lại");
  }
  if (game.versions.some((v) => v.version === input.version)) {
    throw new ApiError(409, "VERSION_EXISTS", "Tên phiên bản đã tồn tại");
  }

  const store = storage();
  const zip = await store.get(input.uploadKey);
  if (!zip) throw new ApiError(400, "UPLOAD_NOT_FOUND", "Không tìm thấy file vừa upload – hãy upload lại");

  let files: BuildFile[];
  let totalBytes: number;
  try {
    if (zip.byteLength > MAX_UPLOAD_BYTES) throw new ApiError(413, "FILE_TOO_LARGE", "File .zip tối đa 50MB");
    ({ files, totalBytes } = extractBuild(zip));
  } catch (err) {
    await store.delete(input.uploadKey).catch(() => undefined);
    if (err instanceof ZipValidationError) throw new ApiError(400, err.code, err.detail ?? err.code);
    throw err;
  }

  const dir = buildDir(game.slug, input.version);
  await inBatches(files, 8, (f) => store.put(`${dir}/${f.path}`, f.data, f.contentType));

  const version = await prisma.gameVersion.create({
    data: {
      gameId: game.id,
      version: input.version,
      storageKey: dir,
      entryFile: "index.html",
      sizeBytes: totalBytes,
      sdkVersion: 1,
      status: "PENDING_REVIEW",
      releaseNotes: input.releaseNotes,
      createdById: userId,
    },
  });

  // Game nháp có bản build đầu tiên → chuyển sang chờ duyệt
  if (game.status === GameStatus.DRAFT) {
    await prisma.game.update({ where: { id: game.id }, data: { status: GameStatus.PENDING_REVIEW } });
  }

  await store.delete(input.uploadKey).catch(() => undefined);
  await logEvent({
    type: "version.upload",
    userId,
    gameId: game.id,
    data: { versionId: version.id, version: version.version, files: files.length, bytes: totalBytes },
  });
  return { id: version.id, version: version.version, status: version.status, files: files.length, sizeBytes: totalBytes };
}

// ───────────── Chơi thử phiên bản ─────────────

/** Admin hoặc thành viên studio sở hữu game được chơi thử mọi phiên bản (kể cả chưa duyệt) */
export async function getPreviewableVersion(user: { id: string; role: string }, versionId: string) {
  const version = await prisma.gameVersion.findUnique({
    where: { id: versionId },
    include: { game: { include: { translations: true, studio: { include: { members: true } } } } },
  });
  if (!version || version.game.deletedAt) return null;
  const isMember = version.game.studio.members.some((m) => m.userId === user.id);
  if (user.role !== "ADMIN" && !isMember) return null;
  return version;
}

// ───────────── Platform API: khóa của game ─────────────

/** Tối đa số khóa đang hoạt động / game (đủ để xoay vòng khóa) */
const MAX_ACTIVE_KEYS = { PUBLISHABLE: 5, SECRET: 2 } as const;

function apiKeyDto(k: { id: string; kind: string; prefix: string; createdAt: Date; lastUsedAt: Date | null; revokedAt: Date | null }) {
  return { id: k.id, kind: k.kind, prefix: k.prefix, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, revokedAt: k.revokedAt };
}

export async function listGameApiKeys(studio: Studio, gameId: string) {
  const game = await findStudioGame(studio.id, gameId);
  const keys = await prisma.apiKey.findMany({ where: { gameId: game.id }, orderBy: { createdAt: "desc" } });
  return keys.map(apiKeyDto);
}

/** Tạo khóa – khóa đầy đủ chỉ trả về đúng 1 lần này */
export async function createGameApiKey(studio: Studio, userId: string, gameId: string, input: ApiKeyCreateInput) {
  assertTermsAccepted(studio);
  const game = await findStudioGame(studio.id, gameId);
  const max = MAX_ACTIVE_KEYS[input.kind];
  const active = await prisma.apiKey.count({ where: { gameId: game.id, kind: input.kind, revokedAt: null } });
  if (active >= max) {
    throw new ApiError(409, "TOO_MANY_KEYS", `Tối đa ${max} khóa loại này đang dùng – thu hồi khóa cũ trước`);
  }
  const { key, keyHash, prefix } = generateApiKey(input.kind);
  const row = await prisma.apiKey.create({ data: { gameId: game.id, kind: input.kind, prefix, keyHash, createdById: userId } });
  await logEvent({ type: "platform.key.create", userId, gameId: game.id, data: { keyId: row.id, prefix, kind: input.kind } });
  return { key, apiKey: apiKeyDto(row) };
}

export async function revokeGameApiKey(studio: Studio, userId: string, gameId: string, keyId: string) {
  const game = await findStudioGame(studio.id, gameId);
  const res = await prisma.apiKey.updateMany({ where: { id: keyId, gameId: game.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (res.count !== 1) throw new ApiError(404, "API_KEY_NOT_FOUND", "Không tìm thấy khóa");
  await logEvent({ type: "platform.key.revoke", userId, gameId: game.id, data: { keyId } });
}

/** Loại sự kiện developer xem được trong nhật ký Platform API của game */
const AUDIT_EVENT_TYPES = [
  "platform.key.create",
  "platform.key.revoke",
  "platform.origins",
  "platform.scoring",
  "score.rejected",
  "score.deleted",
  "player.ban",
  "player.unban",
];
const AUDIT_PAGE = 30;

/** Nhật ký: tạo / thu hồi key, đổi domain, điểm bị từ chối, điểm bị xóa, cấm người chơi */
export async function listGameAuditEvents(studio: Studio, gameId: string, cursor?: string) {
  const game = await findStudioGame(studio.id, gameId);
  const rows = await prisma.event.findMany({
    where: { gameId: game.id, type: { in: AUDIT_EVENT_TYPES } },
    include: { user: { include: { identities: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: AUDIT_PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, AUDIT_PAGE);
  return {
    events: page.map((e) => ({
      id: e.id,
      type: e.type,
      createdAt: e.createdAt,
      data: e.data,
      user: e.user
        ? { id: e.user.id, displayName: displayName({ id: e.user.id, username: e.user.username, walletAddress: primaryWallet(e.user) }) }
        : null,
    })),
    nextCursor: rows.length > AUDIT_PAGE ? page[page.length - 1]!.id : null,
  };
}
