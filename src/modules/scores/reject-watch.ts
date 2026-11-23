import "server-only";
import { redisPipeline, redisRest } from "@/lib/traffic/redis";
import { logEvent } from "@/modules/events/service";
import { raiseAnomaly } from "@/lib/traffic/alerts";
import { log } from "@/lib/log";

/**
 * Theo dõi điểm bị từ chối theo giờ của từng game. Vượt ngưỡng → báo 1 lần / 6 giờ:
 * - Nhật ký hoạt động của developer (sự kiện score.rejected_spike) + khung cảnh báo trên trang game
 * - Admin: mục Bất thường ở stats.monlabs.fun (+ Telegram)
 * Thường là dấu hiệu luật chấm điểm đặt chưa khớp cách chơi thật (hoặc có người gian lận hàng loạt).
 */
/** Lần / giờ (CI đặt REJECT_SPIKE_THRESHOLD nhỏ để test nhanh) */
export const SPIKE_THRESHOLD = Number(process.env.REJECT_SPIKE_THRESHOLD) || 20;
const ALERT_EVERY_SEC = 6 * 3600;

export async function watchRejected(game: { id: string; slug?: string }, reason: string, now = Date.now()) {
  const redis = redisRest();
  if (!redis) return;
  const hour = Math.floor(now / 3_600_000);
  const key = `rej:${game.id}:${hour}`;
  try {
    const res = await redisPipeline(redis, [
      ["HINCRBY", key, reason, 1],
      ["HINCRBY", key, "_total", 1],
      ["EXPIRE", key, 7200],
    ]);
    const total = Number(res[1]);
    if (total < SPIKE_THRESHOLD) return;
    const [lock, all] = await redisPipeline(redis, [
      ["SET", `rej:alert:${game.id}`, String(now), "NX", "EX", ALERT_EVERY_SEC],
      ["HGETALL", key],
    ]);
    if (lock !== "OK") return;
    const flat = (all as string[] | null) ?? [];
    let topReason = reason;
    let topCount = 0;
    for (let i = 0; i + 1 < flat.length; i += 2) {
      if (flat[i] !== "_total" && Number(flat[i + 1]) > topCount) {
        topReason = flat[i]!;
        topCount = Number(flat[i + 1]);
      }
    }
    await logEvent({ type: "score.rejected_spike", userId: null, gameId: game.id, data: { count: total, topReason, threshold: SPIKE_THRESHOLD } });
    await raiseAnomaly("rejected_spike", `Game ${game.slug ?? game.id}: ${total} điểm bị từ chối trong 1 giờ (nhiều nhất ${topReason}) – kiểm tra luật chấm điểm`, {
      data: { gameId: game.id, count: total, topReason },
      dedupeKey: `rejected_spike:${game.id}`,
      dedupeSec: ALERT_EVERY_SEC,
    });
  } catch (err) {
    log.warn("scores.reject_watch_failed", { area: "scores", error: err });
  }
}
