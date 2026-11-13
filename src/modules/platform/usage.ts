import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type UsageField = "apiCalls" | "sessions" | "scores" | "rejected";
const COLUMNS: Record<UsageField, Prisma.Sql> = {
  apiCalls: Prisma.raw('"apiCalls"'),
  sessions: Prisma.raw('"sessions"'),
  scores: Prisma.raw('"scores"'),
  rejected: Prisma.raw('"rejected"'),
};

/**
 * Cộng 1 vào số liệu hôm nay (UTC) của project – 1 câu lệnh upsert, không đọc trước.
 * Lỗi ghi số liệu không được làm hỏng request chính.
 */
export async function trackUsage(gameId: string, field: UsageField): Promise<void> {
  const col = COLUMNS[field];
  try {
    await prisma.$executeRaw`
      INSERT INTO "UsageDaily" ("gameId", "day", ${col})
      VALUES (${gameId}, (now() AT TIME ZONE 'UTC')::date, 1)
      ON CONFLICT ("gameId", "day") DO UPDATE SET ${col} = "UsageDaily".${col} + 1`;
  } catch (err) {
    console.error("[usage] Không ghi được số liệu", field, err);
  }
}
