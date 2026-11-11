import { z } from "zod";

/**
 * Cấu hình lưu trong cột JSON `settings`.
 * Thêm luật mới = thêm field ở đây (có giá trị mặc định), KHÔNG cần migration.
 * Khi ghi dùng .passthrough() để không làm mất các key chưa biết.
 */

export const gameSettingsSchema = z
  .object({
    /** Thời gian chơi tối thiểu (giây) để điểm được chấp nhận */
    minPlaySeconds: z.number().int().min(0).max(3600).default(0),
    /** Lượt chơi bắt đầu quá số giờ này thì không nhận điểm */
    maxSessionHours: z.number().positive().max(72).default(6),
  })
  .passthrough();

export const leaderboardSettingsSchema = z
  .object({
    /** Điểm tối đa hợp lệ (chống gian lận) */
    maxScore: z.number().int().nonnegative().optional(),
    /** Điểm tối thiểu hợp lệ (vd: thời gian hoàn thành không thể dưới X giây) */
    minScore: z.number().int().nonnegative().optional(),
    /** Tốc độ ghi điểm tối đa (điểm/giây) – chặn bot chơi siêu nhanh */
    maxScorePerSecond: z.number().positive().optional(),
    /** Cách hiển thị điểm: "number" (mặc định) hoặc "duration_ms" (thời gian hoàn thành, mili-giây – thường đi với order ASC) */
    format: z.enum(["number", "duration_ms"]).optional(),
    /**
     * Bảng tính theo thời gian (mili-giây): thời gian game báo không được NGẮN hơn thời gian server đo
     * quá số giây này (trừ hao độ trễ mạng) → chặn gửi thời gian giả siêu ngắn
     */
    timedScoreSlackSeconds: z.number().nonnegative().max(60).optional(),
    /**
     * Giải đấu "ăn theo" bảng khác: mỗi điểm hợp lệ nộp vào bảng có key này (thường "default")
     * trong thời gian giải diễn ra cũng được ghi vào bảng này → tổ chức giải mà KHÔNG cần sửa game
     */
    mirrorOf: z.string().max(50).optional(),
  })
  .passthrough();

/**
 * Dữ liệu admin gửi lên để SỬA settings: mọi field tùy chọn, KHÔNG có mặc định
 * (nếu có mặc định, sửa 1 luật sẽ vô tình ghi đè các luật khác về giá trị mặc định).
 */
export const gameSettingsInputSchema = z
  .object({
    minPlaySeconds: z.number().int().min(0).max(3600).optional(),
    maxSessionHours: z.number().positive().max(72).optional(),
  })
  .passthrough();

export type GameSettings = z.infer<typeof gameSettingsSchema>;
export type LeaderboardSettings = z.infer<typeof leaderboardSettingsSchema>;

/** Đọc settings từ DB; dữ liệu hỏng → dùng mặc định thay vì làm sập request */
export function readGameSettings(json: unknown): GameSettings {
  const parsed = gameSettingsSchema.safeParse(json ?? {});
  return parsed.success ? parsed.data : gameSettingsSchema.parse({});
}

export function readLeaderboardSettings(json: unknown): LeaderboardSettings {
  const parsed = leaderboardSettingsSchema.safeParse(json ?? {});
  return parsed.success ? parsed.data : {};
}
