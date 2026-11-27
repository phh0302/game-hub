import "server-only";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/modules/events/service";
import { retentionCutoffs } from "./retention";

/** Mỗi lần chạy xóa tối đa chừng này tài khoản khách (tránh request quá lâu) */
const GUEST_BATCH = 500;

/** Dọn dữ liệu quá hạn giữ – chạy trong cron hằng ngày. Trả về số dòng đã xóa theo loại */
export async function runRetentionCleanup(now = new Date()) {
  const cut = retentionCutoffs(now);

  // Tài khoản khách tạo đã lâu và không chơi gì trong thời gian giữ
  const guests = await prisma.user.findMany({
    where: {
      isGuest: true,
      createdAt: { lt: cut.guests },
      sessions: { none: { startedAt: { gte: cut.guests } } },
    },
    select: { id: true },
    take: GUEST_BATCH,
  });
  const guestIds = guests.map((g) => g.id);

  const [monthlyOfGuests, guestsDeleted, events, reports, monthlyPlayers, webhookDeliveries, roomsExpired, rooms] = await prisma.$transaction([
    prisma.studioMonthlyPlayer.deleteMany({ where: { userId: { in: guestIds } } }),
    prisma.user.deleteMany({ where: { id: { in: guestIds }, isGuest: true } }),
    prisma.event.deleteMany({ where: { createdAt: { lt: cut.events } } }),
    prisma.gameReport.deleteMany({ where: { status: { not: "OPEN" }, resolvedAt: { lt: cut.reports } } }),
    prisma.studioMonthlyPlayer.deleteMany({ where: { month: { lt: cut.monthlyPlayers } } }),
    prisma.webhookDelivery.deleteMany({ where: { createdAt: { lt: cut.webhookDeliveries } } }),
    // Phòng bỏ dở quá hạn mà không ai mở lại → đánh dấu kết thúc
    prisma.room.updateMany({
      where: { status: { not: "FINISHED" }, expiresAt: { lt: now } },
      data: { status: "FINISHED", result: { reason: "expired" } },
    }),
    // Phòng đã kết thúc lâu → xóa (nước đi + người chơi xóa theo)
    prisma.room.deleteMany({ where: { status: "FINISHED", updatedAt: { lt: cut.rooms } } }),
  ]);

  const result = {
    guests: guestsDeleted.count,
    events: events.count,
    reports: reports.count,
    monthlyPlayers: monthlyPlayers.count + monthlyOfGuests.count,
    webhookDeliveries: webhookDeliveries.count,
    roomsExpired: roomsExpired.count,
    rooms: rooms.count,
  };
  if (Object.values(result).some((n) => n > 0)) {
    await logEvent({ type: "maintenance.cleanup", data: result });
  }
  return result;
}
