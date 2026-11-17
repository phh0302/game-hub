// Ghi bất thường + gửi cảnh báo Telegram – chạy được ở middleware (edge) và route (Node)
import { redisPipeline, redisRest } from "./redis";

export type AnomalyType = "traffic_spike" | "error_rate" | "ip_dominant" | "rate_limited_spike" | "ip_blocked";
export type Anomaly = { id: string; type: AnomalyType; at: number; message: string; data?: Record<string, unknown>; alerted: boolean };

const ANOMALIES_KEY = "traffic:anomalies";
const TELEGRAM_CHAT_KEY = "traffic:telegram:chat";
const MAX_ANOMALIES = 500;
const STATS_URL = process.env.STATS_URL || "https://stats.monlabs.fun";

/** Chat nhận cảnh báo: TELEGRAM_CHAT_ID, hoặc chat đã tìm được bằng nút "Tìm chat" trên trang stats */
export async function telegramChatId(): Promise<string | null> {
  if (process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID;
  const redis = redisRest();
  if (!redis) return null;
  try {
    const [chat] = (await redisPipeline(redis, [["GET", TELEGRAM_CHAT_KEY]])) as [string | null];
    return chat;
  } catch {
    return null;
  }
}

export async function saveTelegramChatId(chatId: string) {
  const redis = redisRest();
  if (redis) await redisPipeline(redis, [["SET", TELEGRAM_CHAT_KEY, chatId]]);
}

/** Trạng thái cấu hình Telegram (không trả token) */
export async function telegramStatus() {
  return { tokenSet: Boolean(process.env.TELEGRAM_BOT_TOKEN), chatId: await telegramChatId(), chatFromEnv: Boolean(process.env.TELEGRAM_CHAT_ID) };
}

/**
 * Tìm chat nhận cảnh báo: người quản trị nhắn 1 tin bất kỳ cho bot trước,
 * rồi bấm "Tìm chat" → lấy chat của tin mới nhất bot nhận được và lưu lại.
 */
export async function discoverTelegramChat(): Promise<{ chatId: string; title: string } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=20`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  type Chat = { id: number; title?: string; username?: string; first_name?: string };
  const body = (await res.json()) as { result?: { message?: { chat?: Chat }; my_chat_member?: { chat?: Chat } }[] };
  const chats = (body.result ?? []).map((u) => u.message?.chat ?? u.my_chat_member?.chat).filter((c): c is Chat => Boolean(c));
  const chat = chats[chats.length - 1];
  if (!chat) return null;
  await saveTelegramChatId(String(chat.id));
  return { chatId: String(chat.id), title: chat.title ?? chat.username ?? chat.first_name ?? String(chat.id) };
}

/** Gửi 1 tin Telegram. Chưa cấu hình → false (không lỗi) */
export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = await telegramChatId();
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ghi 1 bất thường và gửi cảnh báo – mỗi `dedupeKey` chỉ cảnh báo 1 lần trong `dedupeSec`
 * (vẫn ghi vào danh sách để xem trên trang stats).
 */
export async function raiseAnomaly(
  type: AnomalyType,
  message: string,
  options: { data?: Record<string, unknown>; dedupeKey?: string; dedupeSec?: number; now?: number } = {},
) {
  const redis = redisRest();
  const now = options.now ?? Date.now();
  let fresh = true;
  if (redis) {
    try {
      const [set] = (await redisPipeline(redis, [
        ["SET", `traffic:alert:${options.dedupeKey ?? type}`, now, "NX", "EX", options.dedupeSec ?? 1800],
      ])) as [string | null];
      fresh = set === "OK";
    } catch {
      fresh = true;
    }
  }
  const anomaly: Anomaly = { id: `${now}-${type}`, type, at: now, message, data: options.data, alerted: false };
  // Trùng trong thời gian chặn lặp → không cảnh báo, không ghi thêm (tránh lặp mỗi phút)
  if (!fresh) return anomaly;
  anomaly.alerted = await sendTelegram(`⚠️ Monlabs – ${message}\n${STATS_URL}`);
  if (redis) {
    await redisPipeline(redis, [
      ["LPUSH", ANOMALIES_KEY, JSON.stringify(anomaly)],
      ["LTRIM", ANOMALIES_KEY, 0, MAX_ANOMALIES - 1],
    ]).catch(() => undefined);
  }
  return anomaly;
}

export async function listAnomalies(limit = 50): Promise<Anomaly[]> {
  const redis = redisRest();
  if (!redis) return [];
  const [rows] = (await redisPipeline(redis, [["LRANGE", ANOMALIES_KEY, 0, limit - 1]])) as [string[]];
  return (rows ?? []).flatMap((r) => {
    try {
      return [JSON.parse(r) as Anomaly];
    } catch {
      return [];
    }
  });
}
