/**
 * Lưu tiến trình hộ game (GameHub.saveState / loadState).
 * Game chạy trong iframe sandbox không có allow-same-origin → origin "null" → localStorage, IndexedDB,
 * cookie của game luôn lỗi. Hub lưu thay trong localStorage của trang hub, mỗi game 1 khóa.
 * Chỉ trên trình duyệt / thiết bị này (chưa đồng bộ qua tài khoản).
 */
export const STATE_MAX_CHARS = 64 * 1024;

export function gameStateKey(scope: string): string {
  return `gamehub:state:${scope}`;
}

/** Xử lý tin STATE_SAVE / STATE_LOAD → payload cho STATE_RESULT (null nếu không phải tin lưu trạng thái) */
export function handleStateMessage(
  type: string,
  payload: Record<string, unknown>,
  scope: string,
): Record<string, unknown> | null {
  const requestId = payload.requestId;
  if (type !== "STATE_SAVE" && type !== "STATE_LOAD") return null;
  const key = gameStateKey(scope);
  try {
    if (type === "STATE_LOAD") {
      return { requestId, data: window.localStorage.getItem(key) };
    }
    const data = payload.data;
    if (typeof data !== "string") return { requestId, saved: false, code: "STATE_INVALID" };
    if (data.length > STATE_MAX_CHARS) return { requestId, saved: false, code: "STATE_TOO_LARGE" };
    window.localStorage.setItem(key, data);
    return { requestId, saved: true, code: null };
  } catch {
    return type === "STATE_LOAD"
      ? { requestId, data: null }
      : { requestId, saved: false, code: "STORAGE_UNAVAILABLE" };
  }
}
