import "server-only";
import { z } from "zod";
import { ReportReason, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { displayName } from "@/lib/format";
import { pickTranslation } from "@/lib/locale";
import { logEvent } from "@/modules/events/service";
import { getVisibleGame } from "@/modules/games/service";
import { primaryWallet } from "@/modules/users/dto";

export const reportCreateSchema = z.object({
  reason: z.nativeEnum(ReportReason),
  message: z.string().trim().max(1000).optional(),
});

export const reportResolveSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
  resolution: z.string().trim().max(1000).optional(),
});

export const reportListQuerySchema = z.object({
  status: z.nativeEnum(ReportStatus).default("OPEN"),
});

/** Người chơi báo cáo game – mỗi người chỉ có 1 báo cáo đang mở cho mỗi game */
export async function createReport(userId: string, slug: string, input: z.infer<typeof reportCreateSchema>) {
  const game = await getVisibleGame(slug);
  const existing = await prisma.gameReport.findFirst({
    where: { gameId: game.id, reporterId: userId, status: "OPEN" },
    select: { id: true },
  });
  if (existing) throw new ApiError(409, "REPORT_EXISTS", "Bạn đã báo cáo game này, admin đang xem xét");

  const report = await prisma.gameReport.create({
    data: { gameId: game.id, reporterId: userId, reason: input.reason, message: input.message || null },
  });
  await logEvent({ type: "report.create", userId, gameId: game.id, data: { reportId: report.id, reason: report.reason } });
  return { id: report.id, status: report.status };
}

export async function adminListReports(status: ReportStatus, locale: string) {
  const [reports, counts] = await Promise.all([
    prisma.gameReport.findMany({
      where: { status },
      orderBy: { createdAt: status === "OPEN" ? "asc" : "desc" },
      take: 200,
      include: {
        game: { select: { id: true, slug: true, status: true, translations: true, studio: { select: { name: true } } } },
        reporter: { include: { identities: true } },
      },
    }),
    prisma.gameReport.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  return {
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<ReportStatus, number>>,
    reports: reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      message: r.message,
      status: r.status,
      resolution: r.resolution,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      game: {
        id: r.game.id,
        slug: r.game.slug,
        status: r.game.status,
        name: pickTranslation(r.game.translations, locale)?.name ?? r.game.slug,
        studio: r.game.studio.name,
      },
      reporter: displayName({ id: r.reporter.id, username: r.reporter.username, walletAddress: primaryWallet(r.reporter) }),
    })),
  };
}

export async function adminResolveReport(id: string, input: z.infer<typeof reportResolveSchema>, adminId: string) {
  const report = await prisma.gameReport.findUnique({ where: { id } });
  if (!report) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy báo cáo");
  const updated = await prisma.gameReport.update({
    where: { id },
    data: { status: input.status, resolution: input.resolution || null, resolvedById: adminId, resolvedAt: new Date() },
  });
  await logEvent({ type: "report.resolve", userId: adminId, gameId: report.gameId, data: { reportId: id, status: input.status } });
  return { id: updated.id, status: updated.status };
}
