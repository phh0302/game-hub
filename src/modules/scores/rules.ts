// Luật chấp nhận điểm – hàm thuần (không import gì) để unit test được

export type ScoreRuleError =
  | "SESSION_EXPIRED" // lượt chơi mở quá lâu
  | "PLAY_TOO_SHORT" // chơi quá ngắn
  | "SCORE_INVALID" // ngoài khoảng điểm cho phép
  | "SCORE_TOO_FAST"; // ghi điểm nhanh bất thường (điểm/giây)

export type ScoreRules = {
  /** Thời gian chơi tối thiểu (giây), tính từ GAME_START */
  minPlaySeconds: number;
  /** Lượt chơi mở quá số giờ này thì không nhận điểm */
  maxSessionHours: number;
  maxScore?: number;
  minScore?: number;
  /**
   * Tốc độ ghi điểm tối đa (điểm/giây) – do server tự tính, game không sửa được.
   * Bắt được bot chơi siêu nhanh mà vẫn không phạt người thua nhanh với điểm thấp.
   */
  maxScorePerSecond?: number;
  /** Điểm là thời gian (ms): không được ngắn hơn thời gian server đo quá số giây này */
  timedScoreSlackSeconds?: number;
};

/** null = điểm hợp lệ; ngược lại trả mã lỗi */
export function checkScore(input: { score: number; durationSeconds: number }, rules: ScoreRules): ScoreRuleError | null {
  const { score, durationSeconds } = input;

  if (durationSeconds > rules.maxSessionHours * 3600) return "SESSION_EXPIRED";
  if (durationSeconds < rules.minPlaySeconds) return "PLAY_TOO_SHORT";
  if (rules.maxScore !== undefined && score > rules.maxScore) return "SCORE_INVALID";
  if (rules.minScore !== undefined && score < rules.minScore) return "SCORE_INVALID";
  if (rules.maxScorePerSecond !== undefined && score > rules.maxScorePerSecond * Math.max(durationSeconds, 1)) {
    return "SCORE_TOO_FAST";
  }
  if (rules.timedScoreSlackSeconds !== undefined && score < (durationSeconds - rules.timedScoreSlackSeconds) * 1000) {
    return "SCORE_INVALID";
  }
  return null;
}
