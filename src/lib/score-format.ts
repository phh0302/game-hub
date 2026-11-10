// Hiển thị điểm theo kiểu của bảng xếp hạng – hàm thuần, dùng chung server + trình duyệt

/** number: điểm thường · duration_ms: thời gian hoàn thành tính bằng mili-giây (hiện dạng 1:05,3) */
export type ScoreFormat = "number" | "duration_ms";

export function formatScore(value: number, format: ScoreFormat | null | undefined, locale: string): string {
  const tag = locale === "vi" ? "vi-VN" : "en-US";
  if (format !== "duration_ms") return new Intl.NumberFormat(tag).format(value);
  const tenths = Math.round(Math.max(0, value) / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = (tenths % 600) / 10;
  const sec = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1, minimumIntegerDigits: 2 }).format(seconds);
  return `${minutes}:${sec}`;
}
