/**
 * Sự kiện game (GameHub.track) – kiểm tra dữ liệu, dùng chung cho SDK (logic giống), API hub và Platform API.
 * Chỉ đếm số lần theo tên sự kiện / ngày; props được giữ trong danh sách "gần đây" để developer kiểm tra tích hợp.
 */
export const EVENT_NAME = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
export const MAX_EVENTS_PER_BATCH = 50;
export const MAX_PROPS = 10;
export const MAX_PROP_STRING = 100;

export type GameEvent = { name: string; props?: Record<string, string | number | boolean> };

/** Lọc lô sự kiện: bỏ sự kiện sai tên; props chỉ giữ ≤ 10 khóa kiểu chuỗi (≤ 100 ký tự) / số hữu hạn / boolean */
export function normalizeEvents(input: unknown): GameEvent[] {
  if (!Array.isArray(input)) return [];
  const out: GameEvent[] = [];
  for (const raw of input.slice(0, MAX_EVENTS_PER_BATCH)) {
    if (!raw || typeof raw !== "object") continue;
    const name = (raw as { name?: unknown }).name;
    if (typeof name !== "string" || !EVENT_NAME.test(name)) continue;
    const ev: GameEvent = { name };
    const props = (raw as { props?: unknown }).props;
    if (props && typeof props === "object" && !Array.isArray(props)) {
      const clean: Record<string, string | number | boolean> = {};
      let n = 0;
      for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
        if (n >= MAX_PROPS) break;
        if (!/^[A-Za-z0-9_]{1,40}$/.test(k)) continue;
        if (typeof v === "string") clean[k] = v.slice(0, MAX_PROP_STRING);
        else if (typeof v === "number" && Number.isFinite(v)) clean[k] = v;
        else if (typeof v === "boolean") clean[k] = v;
        else continue;
        n++;
      }
      if (n > 0) ev.props = clean;
    }
    out.push(ev);
  }
  return out;
}
