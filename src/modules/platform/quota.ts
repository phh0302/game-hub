import "server-only";
import type { Studio } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { logEvent } from "@/modules/events/service";
import { effectivePlan, monthStart, warnLevel, type PlanLimits, type QuotaMetric, type Tier } from "./plans";

/**
 * Hạn mức gói (12c) – CHỈ áp cho Platform API (game chạy ngoài hub: Client API / Server API).
 * Chơi trên hub không bị tính. Hết hạn mức: vẫn chơi được nhưng không lưu điểm (SDK báo rõ).
 */

export type StudioPlan = { studioId: string; tier: Tier; expired: boolean; limits: PlanLimits };

const PLAN_SELECT = { id: true, plan: true, planExpiresAt: true, planLimits: true } as const;

export function planOf(studio: Pick<Studio, "id" | "plan" | "planExpiresAt" | "planLimits">): StudioPlan {
  return { studioId: studio.id, ...effectivePlan(studio) };
}

export async function planForStudio(studioId: string): Promise<StudioPlan> {
  return planOf(await prisma.studio.findUniqueOrThrow({ where: { id: studioId }, select: PLAN_SELECT }));
}

export async function planForGame(gameId: string): Promise<StudioPlan> {
  const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId }, select: { studio: { select: PLAN_SELECT } } });
  return planOf(game.studio);
}

/** Tính năng chỉ có ở gói trả phí (Server API, webhook) */
export function assertFeature(plan: StudioPlan, feature: "serverApi" | "webhooks") {
  if (!plan.limits[feature]) {
    throw new ApiError(
      403,
      "PLAN_REQUIRED",
      feature === "serverApi" ? "Server API cần gói Pro trở lên" : "Webhook cần gói Pro trở lên",
    );
  }
}

/** Mốc cảnh báo 80% / 100%: ghi 1 lần mỗi tháng / chỉ số vào nhật ký của game vừa dùng */
async function maybeWarn(plan: StudioPlan, metric: QuotaMetric, used: number, gameId: string) {
  const level = warnLevel(used, plan.limits[metric]);
  if (!level) return;
  const month = monthStart();
  const tag = `${metric}:${level}`;
  // Thêm mốc nếu chưa có – 1 câu lệnh, không đọc trước → không ghi trùng khi nhiều request cùng lúc
  const added = await prisma.$executeRaw`
    INSERT INTO "StudioUsageMonth" ("studioId", "month", "warnings") VALUES (${plan.studioId}, ${month}::date, ARRAY[${tag}]::text[])
    ON CONFLICT ("studioId", "month") DO UPDATE SET "warnings" = array_append("StudioUsageMonth"."warnings", ${tag}::text)
    WHERE NOT (${tag}::text = ANY("StudioUsageMonth"."warnings"))`;
  if (added > 0) {
    await logEvent({ type: "quota.warning", gameId, data: { metric, percent: level, used, limit: plan.limits[metric] } });
  }
}

/**
 * Ghi nhận người chơi hoạt động trong tháng. true = được phép (đã có / còn chỗ), false = vượt hạn mức.
 * Người đã tính trong tháng thì luôn được phép.
 */
export async function admitPlayer(plan: StudioPlan, userId: string, gameId: string): Promise<boolean> {
  const month = monthStart();
  const key = { studioId_month_userId: { studioId: plan.studioId, month, userId } };
  if (await prisma.studioMonthlyPlayer.findUnique({ where: key })) return true;
  const limit = plan.limits.activePlayers;
  const count = await prisma.studioMonthlyPlayer.count({ where: { studioId: plan.studioId, month } });
  if (limit !== null && count >= limit) {
    await maybeWarn(plan, "activePlayers", count, gameId);
    return false;
  }
  await prisma.studioMonthlyPlayer.createMany({ data: [{ studioId: plan.studioId, month, userId }], skipDuplicates: true });
  await maybeWarn(plan, "activePlayers", count + 1, gameId);
  return true;
}

/** Trước khi lưu điểm qua Platform API: người chơi + số lần nộp điểm trong tháng */
export async function assertCanSaveScore(plan: StudioPlan, userId: string, gameId: string) {
  if (!(await admitPlayer(plan, userId, gameId))) {
    throw new ApiError(403, "QUOTA_PLAYERS", "Game đã hết hạn mức người chơi của tháng này – điểm chưa được lưu");
  }
  const limit = plan.limits.scores;
  if (limit === null) return;
  const row = await prisma.studioUsageMonth.findUnique({
    where: { studioId_month: { studioId: plan.studioId, month: monthStart() } },
    select: { scores: true },
  });
  if ((row?.scores ?? 0) >= limit) {
    throw new ApiError(403, "QUOTA_SCORES", "Game đã hết hạn mức lưu điểm của tháng này – điểm chưa được lưu");
  }
}

/** Sau khi lưu điểm qua Platform API */
export async function recordScore(plan: StudioPlan, gameId: string) {
  const month = monthStart();
  const rows = await prisma.$queryRaw<{ scores: number }[]>`
    INSERT INTO "StudioUsageMonth" ("studioId", "month", "scores") VALUES (${plan.studioId}, ${month}::date, 1)
    ON CONFLICT ("studioId", "month") DO UPDATE SET "scores" = "StudioUsageMonth"."scores" + 1
    RETURNING "scores"`;
  await maybeWarn(plan, "scores", rows[0]?.scores ?? 0, gameId);
}

/** Số project = game của studio đang có ít nhất 1 key chưa thu hồi */
export async function countProjects(studioId: string) {
  return prisma.game.count({
    where: { studioId, deletedAt: null, apiKeys: { some: { revokedAt: null } } },
  });
}

/** Game này đã là project chưa; nếu chưa thì còn chỗ cho thêm 1 project không */
export async function assertCanAddProject(plan: StudioPlan, gameId: string) {
  const already = await prisma.apiKey.count({ where: { gameId, revokedAt: null } });
  if (already > 0 || plan.limits.projects === null) return;
  if ((await countProjects(plan.studioId)) >= plan.limits.projects) {
    throw new ApiError(403, "QUOTA_PROJECTS", `Gói hiện tại cho tối đa ${plan.limits.projects} game dùng Platform API`);
  }
}

/** Giải đấu đang mở = bảng phụ có thời hạn chưa kết thúc */
export async function countOpenTournaments(studioId: string) {
  return prisma.leaderboard.count({
    where: { game: { studioId }, deletedAt: null, endsAt: { gt: new Date() } },
  });
}

export async function assertCanAddTournament(plan: StudioPlan, endsAt: Date | null | undefined) {
  const limit = plan.limits.openTournaments;
  if (limit === null || !endsAt) return;
  if ((await countOpenTournaments(plan.studioId)) >= limit) {
    throw new ApiError(403, "QUOTA_TOURNAMENTS", `Gói hiện tại cho tối đa ${limit} giải đấu đang mở`);
  }
}

/** Tổng hợp cho trang Developer / Admin */
export async function quotaSummary(studioId: string) {
  const plan = await planForStudio(studioId);
  const studio = await prisma.studio.findUniqueOrThrow({ where: { id: studioId }, select: { planExpiresAt: true, plan: true } });
  const month = monthStart();
  const [projects, activePlayers, usage, openTournaments] = await Promise.all([
    countProjects(studioId),
    prisma.studioMonthlyPlayer.count({ where: { studioId, month } }),
    prisma.studioUsageMonth.findUnique({ where: { studioId_month: { studioId, month } }, select: { scores: true } }),
    countOpenTournaments(studioId),
  ]);
  const used: Record<QuotaMetric, number> = { projects, activePlayers, scores: usage?.scores ?? 0, openTournaments };
  return {
    plan: plan.tier,
    assignedPlan: studio.plan,
    expired: plan.expired,
    expiresAt: studio.planExpiresAt,
    month: month.toISOString().slice(0, 7),
    limits: plan.limits,
    usage: (Object.keys(used) as QuotaMetric[]).map((metric) => ({
      metric,
      used: used[metric],
      limit: plan.limits[metric],
      level: warnLevel(used[metric], plan.limits[metric]),
    })),
  };
}
