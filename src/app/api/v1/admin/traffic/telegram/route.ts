import { z } from "zod";
import { ApiError, handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { discoverTelegramChat, sendTelegram, telegramStatus } from "@/lib/traffic/alerts";
import { logEvent } from "@/modules/events/service";

const bodySchema = z.object({
  action: z.enum(["discover", "test", "report"]),
  /** action "report": nội dung báo cáo (vd kết quả stress test) – chữ thường, tối đa 3.500 ký tự */
  text: z.string().trim().min(1).max(3500).optional(),
});

/** Admin: tìm chat nhận cảnh báo (sau khi đã nhắn bot) / gửi tin thử / gửi báo cáo */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { action, text } = bodySchema.parse(await readJson(req));
    if (!process.env.TELEGRAM_BOT_TOKEN) throw new ApiError(400, "TELEGRAM_NOT_CONFIGURED", "Chưa đặt TELEGRAM_BOT_TOKEN");
    if (action === "discover") {
      const chat = await discoverTelegramChat();
      if (!chat) throw new ApiError(404, "TELEGRAM_CHAT_NOT_FOUND", "Chưa thấy tin nhắn nào gửi cho bot");
      await logEvent({ type: "traffic.telegram_chat", userId: admin.id, data: { chatId: chat.chatId } });
      return ok({ chat, telegram: await telegramStatus() });
    }
    if (action === "report") {
      if (!text) throw new ApiError(400, "VALIDATION_ERROR", "Thiếu nội dung báo cáo");
      const sent = await sendTelegram(`📋 Báo cáo từ admin\n${text}`);
      if (!sent) throw new ApiError(502, "TELEGRAM_SEND_FAILED", "Gửi báo cáo không thành công");
      await logEvent({ type: "traffic.telegram_report", userId: admin.id, data: { length: text.length } });
      return ok({ sent: true });
    }
    const sent = await sendTelegram("✅ Monlabs – tin thử: cảnh báo lưu lượng sẽ gửi về đây.");
    if (!sent) throw new ApiError(502, "TELEGRAM_SEND_FAILED", "Gửi tin thử không thành công");
    return ok({ sent: true });
  });
}
