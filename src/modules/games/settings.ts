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
