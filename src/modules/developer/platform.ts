import "server-only";
import { z } from "zod";
import type { Studio, WebhookDelivery } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { logEvent } from "@/modules/events/service";
import { randomBase62 } from "@/modules/platform/keys";
import { normalizeWebhookUrl } from "@/modules/platform/webhook-utils";
import { deliverWebhook, WEBHOOK_ALLOW_PRIVATE } from "@/modules/platform/webhooks";
import { assertTermsAccepted, findStudioGame } from "./service";

/** Trang Developer: webhook và số liệu dùng Platform API của 1 game */

// ───────────── Webhook ─────────────

export const webhookUpdateSchema = z.object({ url: z.string().trim().max(500).nullable() });

function newWebhookSecret() {
  return `whsec_${randomBase62(32)}`;
}

function deliveryDto(d: WebhookDelivery) {
  return {
    id: d.id,
    event: d.event,
    status: d.status,
    attempts: d.attempts,
    lastStatusCode: d.lastStatusCode,
    lastError: d.lastError,
    nextAttemptAt: d.nextAttemptAt,
    createdAt: d.createdAt,
    deliveredAt: d.deliveredAt,
  };
}

export async function getWebhookConfig(studio: Studio, gameId: string) {
  const game = await findStudioGame(studio.id, gameId);
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { gameId: game.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const row = await prisma.game.findUniqueOrThrow({ where: { id: game.id }, select: { webhookUrl: true, webhookSecret: true } });
  return {
    url: row.webhookUrl,
    hasSecret: Boolean(row.webhookSecret),
    secretHint: row.webhookSecret ? `${row.webhookSecret.slice(0, 10)}…` : null,
    deliveries: deliveries.map(deliveryDto),
  };
}

/** Đặt / tắt URL webhook. Lần đầu bật thì tạo khóa ký → trả về đúng 1 lần */
export async function setWebhookUrl(studio: Studio, userId: string, gameId: string, input: z.infer<typeof webhookUpdateSchema>) {
  assertTermsAccepted(studio);
  const game = await findStudioGame(studio.id, gameId);
  const url = input.url ? normalizeWebhookUrl(input.url, WEBHOOK_ALLOW_PRIVATE) : null;
  if (input.url && !url) {
    throw new ApiError(400, "INVALID_WEBHOOK_URL", "URL webhook phải là https và không trỏ vào mạng nội bộ");
  }
  const row = await prisma.game.findUniqueOrThrow({ where: { id: game.id }, select: { webhookSecret: true } });
  const secret = url && !row.webhookSecret ? newWebhookSecret() : null;
  await prisma.game.update({
    where: { id: game.id },
    data: { webhookUrl: url, ...(secret ? { webhookSecret: secret } : {}) },
  });
  await logEvent({ type: "platform.webhook", userId, gameId: game.id, data: { url } });
  return { url, secret };
}

export async function rotateWebhookSecret(studio: Studio, userId: string, gameId: string) {
  assertTermsAccepted(studio);
  const game = await findStudioGame(studio.id, gameId);
  const secret = newWebhookSecret();
  await prisma.game.update({ where: { id: game.id }, data: { webhookSecret: secret } });
  await logEvent({ type: "platform.webhook.rotate", userId, gameId: game.id });
  return { secret };
}

/** Gửi thử sự kiện "ping" và chờ kết quả để hiện ngay trên giao diện */
export async function sendTestWebhook(studio: Studio, gameId: string) {
  const game = await findStudioGame(studio.id, gameId);
  const row = await prisma.game.findUniqueOrThrow({ where: { id: game.id }, select: { webhookUrl: true } });
  if (!row.webhookUrl) throw new ApiError(400, "WEBHOOK_NOT_SET", "Chưa đặt URL webhook");
  const delivery = await prisma.webhookDelivery.create({
    data: { gameId: game.id, event: "ping", payload: { message: "Hello from Monlabs" }, nextAttemptAt: new Date() },
  });
  const result = await deliverWebhook(delivery.id);
  return { delivery: result ? deliveryDto(result) : null };
}

export async function retryWebhookDelivery(studio: Studio, gameId: string, deliveryId: string) {
  const game = await findStudioGame(studio.id, gameId);
  const d = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
  if (!d || d.gameId !== game.id) throw new ApiError(404, "DELIVERY_NOT_FOUND", "Không tìm thấy lần gửi");
  if (d.status === "SUCCEEDED") throw new ApiError(409, "DELIVERY_SUCCEEDED", "Sự kiện này đã gửi thành công");
  const result = await deliverWebhook(d.id, { force: true });
  return { delivery: result ? deliveryDto(result) : null };
}

// ───────────── Số liệu ─────────────

export const usageQuerySchema = z.object({ days: z.enum(["7", "30", "90"]).default("30").transform(Number) });

/** Số liệu theo ngày (UTC): lượt gọi API, lượt chơi, điểm, điểm bị từ chối, người chơi hoạt động */
export async function getGameUsage(studio: Studio, gameId: string, days: number) {
  const game = await findStudioGame(studio.id, gameId);
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const from = new Date(today.getTime() - (days - 1) * 86_400_000);

  const [rows, active, activeTotal] = await Promise.all([
    prisma.usageDaily.findMany({ where: { gameId: game.id, day: { gte: from } } }),
    prisma.$queryRaw<{ day: Date; players: number }[]>`
      SELECT ("startedAt" AT TIME ZONE 'UTC')::date AS day, COUNT(DISTINCT "userId")::int AS players
      FROM "GameSession" WHERE "gameId" = ${game.id} AND "startedAt" >= ${from}
      GROUP BY 1`,
    prisma.$queryRaw<{ players: number }[]>`
      SELECT COUNT(DISTINCT "userId")::int AS players
      FROM "GameSession" WHERE "gameId" = ${game.id} AND "startedAt" >= ${from}`,
  ]);

  const key = (d: Date) => d.toISOString().slice(0, 10);
  const byDay = new Map(rows.map((r) => [key(r.day), r]));
  const activeByDay = new Map(active.map((r) => [key(new Date(r.day)), r.players]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = key(new Date(from.getTime() + i * 86_400_000));
    const r = byDay.get(day);
    return {
      day,
      apiCalls: r?.apiCalls ?? 0,
      sessions: r?.sessions ?? 0,
      scores: r?.scores ?? 0,
      rejected: r?.rejected ?? 0,
      activePlayers: activeByDay.get(day) ?? 0,
    };
  });
  const sum = (k: "apiCalls" | "sessions" | "scores" | "rejected") => series.reduce((a, d) => a + d[k], 0);
  return {
    days,
    totals: {
      apiCalls: sum("apiCalls"),
      sessions: sum("sessions"),
      scores: sum("scores"),
      rejected: sum("rejected"),
      activePlayers: activeTotal[0]?.players ?? 0,
    },
    series,
  };
}
