import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { logEvent } from "@/modules/events/service";
import { quotaSummary } from "./quota";

/** Admin gán gói bằng tay (khách beta, Business theo hợp đồng) – chưa có thanh toán (12d) */

const limitValue = z.number().int().min(0).max(1_000_000_000).nullable().optional();

export const planUpdateSchema = z.object({
  plan: z.enum(["FREE", "PRO", "BUSINESS"]),
  /** null = không hết hạn */
  expiresAt: z.coerce.date().nullable().optional(),
  /** Hạn mức riêng; null ở 1 mục = không giới hạn; bỏ trống cả object = dùng mặc định của gói */
  limits: z
    .object({
      projects: limitValue,
      activePlayers: limitValue,
      scores: limitValue,
      openTournaments: limitValue,
    })
    .strict()
    .nullable()
    .optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function adminListStudioPlans() {
  const studios = await prisma.studio.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, slug: true, name: true, isOfficial: true, plan: true, planExpiresAt: true, planLimits: true, planNote: true },
  });
  return Promise.all(
    studios.map(async (s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      isOfficial: s.isOfficial,
      plan: s.plan,
      expiresAt: s.planExpiresAt,
      limits: (s.planLimits as Record<string, number | null> | null) ?? null,
      note: s.planNote,
      summary: await quotaSummary(s.id),
    })),
  );
}

export async function adminSetStudioPlan(studioId: string, input: z.infer<typeof planUpdateSchema>, actorId: string) {
  const studio = await prisma.studio.findUnique({ where: { id: studioId } });
  if (!studio || studio.deletedAt) throw new ApiError(404, "STUDIO_NOT_FOUND", "Không tìm thấy studio");
  const limits = input.limits
    ? Object.fromEntries(Object.entries(input.limits).filter(([, v]) => v !== undefined))
    : null;
  await prisma.studio.update({
    where: { id: studioId },
    data: {
      plan: input.plan,
      planExpiresAt: input.expiresAt ?? null,
      planLimits: limits && Object.keys(limits).length > 0 ? (limits as Prisma.InputJsonObject) : Prisma.DbNull,
      planNote: input.note ?? null,
    },
  });
  await logEvent({
    type: "studio.plan",
    userId: actorId,
    data: { studioId, plan: input.plan, expiresAt: input.expiresAt?.toISOString() ?? null, limits },
  });
  return quotaSummary(studioId);
}
