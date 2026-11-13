import "server-only";
import { lookup } from "node:dns/promises";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/modules/events/service";
import {
  isPrivateAddress,
  nextRetryAt,
  signWebhook,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_SIGNATURE_HEADER,
} from "./webhook-utils";

/** Chỉ test tự động mới được gửi tới địa chỉ nội bộ (máy nhận webhook chạy cùng máy) */
export const WEBHOOK_ALLOW_PRIVATE = process.env.WEBHOOK_ALLOW_PRIVATE === "1";
const TIMEOUT_MS = 5_000;
/** Giữ chỗ khi đang gửi – 2 tiến trình không gửi trùng 1 sự kiện */
const LEASE_MS = 60_000;

export type WebhookEvent = "score.submitted" | "ping";

/**
 * Ghi sự kiện vào hàng đợi và gửi ngay sau khi trả lời request (after) – không làm chậm người chơi.
 * Tiện thể gửi lại vài sự kiện lỗi đến hạn của cùng project.
 */
export async function enqueueWebhook(gameId: string, event: WebhookEvent, payload: Prisma.InputJsonObject) {
  try {
    const game = await prisma.game.findUnique({ where: { id: gameId }, select: { webhookUrl: true } });
    if (!game?.webhookUrl) return null;
    const delivery = await prisma.webhookDelivery.create({
      data: { gameId, event, payload, nextAttemptAt: new Date() },
    });
    after(async () => {
      await deliverWebhook(delivery.id);
      await processDueWebhooks({ gameId, limit: 3 });
    });
    return delivery.id;
  } catch (err) {
    console.error("[webhook] Không tạo được sự kiện", event, err);
    return null;
  }
}

async function assertPublicHost(url: URL) {
  if (WEBHOOK_ALLOW_PRIVATE) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("Địa chỉ webhook trỏ vào mạng nội bộ");
  }
}

/** Gửi 1 sự kiện (có giữ chỗ). Trả về trạng thái sau khi gửi */
export async function deliverWebhook(id: string, options: { force?: boolean } = {}) {
  const now = new Date();
  // Giữ chỗ: chỉ 1 tiến trình gửi được (đang PENDING và đến hạn, hoặc gửi lại bằng tay)
  const claimed = await prisma.webhookDelivery.updateMany({
    where: options.force
      ? { id, status: { not: "SUCCEEDED" } }
      : { id, status: "PENDING", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    data: { status: "PENDING", nextAttemptAt: new Date(now.getTime() + LEASE_MS) },
  });
  if (claimed.count !== 1) return null;

  const delivery = await prisma.webhookDelivery.findUniqueOrThrow({
    where: { id },
    include: { game: { select: { webhookUrl: true, webhookSecret: true } } },
  });
  const attempts = delivery.attempts + 1;
  let statusCode: number | null = null;
  let error: string | null = null;

  try {
    const { webhookUrl, webhookSecret } = delivery.game;
    if (!webhookUrl || !webhookSecret) throw new Error("Project chưa cấu hình webhook");
    const url = new URL(webhookUrl);
    await assertPublicHost(url);
    const body = JSON.stringify({
      id: delivery.id,
      type: delivery.event,
      createdAt: delivery.createdAt.toISOString(),
      gameId: delivery.gameId,
      data: delivery.payload,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Monlabs-Webhooks/1",
        [WEBHOOK_SIGNATURE_HEADER]: signWebhook(webhookSecret, timestamp, body),
        "x-monlabs-event": delivery.event,
        "x-monlabs-delivery": delivery.id,
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    statusCode = res.status;
    await res.body?.cancel().catch(() => undefined);
    if (res.status < 200 || res.status >= 300) error = `HTTP ${res.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message.slice(0, 300) : "Lỗi không xác định";
  }

  if (!error) {
    return prisma.webhookDelivery.update({
      where: { id },
      data: { status: "SUCCEEDED", attempts, lastStatusCode: statusCode, lastError: null, deliveredAt: new Date(), nextAttemptAt: null },
    });
  }
  const retryAt = attempts < WEBHOOK_MAX_ATTEMPTS ? nextRetryAt(attempts) : null;
  const updated = await prisma.webhookDelivery.update({
    where: { id },
    data: { status: retryAt ? "PENDING" : "FAILED", attempts, lastStatusCode: statusCode, lastError: error, nextAttemptAt: retryAt },
  });
  if (!retryAt) {
    await logEvent({ type: "webhook.failed", gameId: delivery.gameId, data: { deliveryId: id, event: delivery.event, error } });
  }
  return updated;
}

/** Gửi lại các sự kiện lỗi đã đến hạn (gọi kèm sự kiện mới, từ cron hằng ngày, hoặc developer bấm gửi lại) */
export async function processDueWebhooks(options: { gameId?: string; limit?: number } = {}) {
  const due = await prisma.webhookDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() }, ...(options.gameId ? { gameId: options.gameId } : {}) },
    orderBy: { nextAttemptAt: "asc" },
    take: options.limit ?? 50,
    select: { id: true },
  });
  let sent = 0;
  for (const d of due) {
    if (await deliverWebhook(d.id)) sent++;
  }
  return { processed: due.length, sent };
}
