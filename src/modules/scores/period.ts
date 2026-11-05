// Hàm thuần (không import gì) – tách riêng để unit test

export type Period = "day" | "week" | "all";

// Kỳ ngày/tuần tính theo giờ Việt Nam (UTC+7, không có giờ mùa hè)
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Thời điểm bắt đầu kỳ: 0h hôm nay / 0h thứ Hai tuần này (giờ VN) */
export function periodStart(period: Period, now = new Date()): Date {
  if (period === "all") return new Date(0);
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  let start = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate());
  if (period === "week") start -= ((vn.getUTCDay() + 6) % 7) * DAY_MS;
  return new Date(start - VN_OFFSET_MS);
}

/** Bảng xếp hạng có đang nhận điểm không (giải đấu có thời gian bắt đầu/kết thúc) */
export function isBoardOpen(board: { startsAt: Date | null; endsAt: Date | null }, now = new Date()) {
  return (!board.startsAt || board.startsAt <= now) && (!board.endsAt || now < board.endsAt);
}
