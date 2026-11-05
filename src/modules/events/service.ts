import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Các loại sự kiện đang dùng – thêm loại mới không cần đổi database */
export type EventType = "auth.login" | "session.start" | "score.submit" | (string & {});

/**
 * Ghi nhật ký sự kiện (chỉ ghi thêm). Lỗi ghi log không được làm hỏng nghiệp vụ chính.
 */
export async function logEvent(event: {
  type: EventType;
  userId?: string | null;
  gameId?: string | null;
  data?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.event.create({
      data: { type: event.type, userId: event.userId ?? null, gameId: event.gameId ?? null, data: event.data },
    });
  } catch (err) {
    console.error("[events] Không ghi được sự kiện", event.type, err);
  }
}
