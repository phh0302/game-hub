// Hàm thuần (không import alias / server-only) – dùng được trong unit test

/**
 * Thời gian giữ dữ liệu (xem tài liệu "Nháp: Điều khoản dịch vụ & Chính sách dữ liệu", Phần C).
 * Đổi số ở đây là đổi chính sách – nhớ cập nhật tài liệu.
 */
export const RETENTION = {
  /** Tài khoản khách không có lượt chơi nào trong khoảng này → xóa */
  guestInactiveDays: 365,
  /** Nhật ký sự kiện */
  eventsDays: 730,
  /** Báo cáo game đã xử lý (tính từ lúc xử lý) */
  resolvedReportsDays: 730,
  /** Danh sách người chơi hoạt động theo tháng (đếm hạn mức) */
  monthlyPlayersMonths: 13,
  /** Lịch sử gửi webhook */
  webhookDeliveriesDays: 30,
} as const;

const DAY = 86_400_000;

export function retentionCutoffs(now = new Date()) {
  return {
    guests: new Date(now.getTime() - RETENTION.guestInactiveDays * DAY),
    events: new Date(now.getTime() - RETENTION.eventsDays * DAY),
    reports: new Date(now.getTime() - RETENTION.resolvedReportsDays * DAY),
    // Tháng cũ nhất còn giữ: tháng hiện tại lùi 12 tháng → giữ đủ 13 tháng
    monthlyPlayers: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (RETENTION.monthlyPlayersMonths - 1), 1)),
    webhookDeliveries: new Date(now.getTime() - RETENTION.webhookDeliveriesDays * DAY),
  };
}
