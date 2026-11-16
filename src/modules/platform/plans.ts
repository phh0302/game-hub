// Hàm thuần (không import alias / server-only) – dùng được trong unit test

export type Tier = "FREE" | "PRO" | "BUSINESS";
export type QuotaMetric = "projects" | "activePlayers" | "scores" | "openTournaments";

export type PlanLimits = {
  /** null = không giới hạn */
  projects: number | null;
  activePlayers: number | null;
  scores: number | null;
  openTournaments: number | null;
  serverApi: boolean;
  webhooks: boolean;
  /** Bắt buộc hiện "Powered by Monlabs" trong game */
  branding: boolean;
};

/** Bảng giá (xem tài liệu "Kế hoạch: Game Hub thành PaaS"). Giá chỉ để hiển thị – chưa thu tiền (12d) */
export const PLANS: Record<Tier, PlanLimits & { priceUsd: number | null }> = {
  FREE: { projects: 2, activePlayers: 500, scores: 10_000, openTournaments: 1, serverApi: false, webhooks: false, branding: true, priceUsd: 0 },
  PRO: { projects: 10, activePlayers: 10_000, scores: 500_000, openTournaments: null, serverApi: true, webhooks: true, branding: false, priceUsd: 9 },
  // Business: mặc định rộng rãi, hạn mức thật theo hợp đồng (admin đặt planLimits)
  BUSINESS: { projects: null, activePlayers: 100_000, scores: 5_000_000, openTournaments: null, serverApi: true, webhooks: true, branding: false, priceUsd: null },
};

export const QUOTA_METRICS: QuotaMetric[] = ["projects", "activePlayers", "scores", "openTournaments"];
export const WARN_PERCENTS = [80, 100] as const;

type StudioPlanFields = { plan: Tier; planExpiresAt: Date | string | null; planLimits: unknown };

/** Gói đang có hiệu lực: hết hạn → FREE (bỏ cả hạn mức riêng) */
export function effectivePlan(studio: StudioPlanFields, now = new Date()): { tier: Tier; expired: boolean; limits: PlanLimits } {
  const expired = studio.planExpiresAt !== null && new Date(studio.planExpiresAt).getTime() <= now.getTime();
  const tier: Tier = expired ? "FREE" : studio.plan;
  const p = PLANS[tier];
  const limits: PlanLimits = {
    projects: p.projects,
    activePlayers: p.activePlayers,
    scores: p.scores,
    openTournaments: p.openTournaments,
    serverApi: p.serverApi,
    webhooks: p.webhooks,
    branding: p.branding,
  };
  if (!expired && studio.planLimits && typeof studio.planLimits === "object") {
    const o = studio.planLimits as Record<string, unknown>;
    for (const k of QUOTA_METRICS) {
      const v = o[k];
      if (v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0)) limits[k] = v as number | null;
    }
    for (const k of ["serverApi", "webhooks", "branding"] as const) {
      if (typeof o[k] === "boolean") limits[k] = o[k] as boolean;
    }
  }
  return { tier, expired, limits };
}

/** Mốc cảnh báo cao nhất đã chạm (80 / 100) hoặc null */
export function warnLevel(used: number, limit: number | null): 80 | 100 | null {
  if (limit === null) return null;
  if (limit === 0 || used >= limit) return 100;
  if (used * 100 >= limit * 80) return 80;
  return null;
}

/** Ngày đầu tháng (UTC) */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
