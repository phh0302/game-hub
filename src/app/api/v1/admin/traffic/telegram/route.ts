import { z } from "zod";
import { ApiError, handle, ok, readJson } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { discoverTelegramChat, sendTelegram, telegramStatus } from "@/lib/traffic/alerts";
import { logEvent } from "@/modules/events/service";

const bodySchema = z.object({ action: z.enum(["discover", "test"]) });

/** Admin: tìm chat nhận cảnh báo (sau khi đã nhắn bot) / gửi tin thử */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { action } = bodySchema.parse(await readJson(req));
    if (!process.env.TELEGRAM_BOT_TOKEN) throw new ApiError(400, "TELEGRAM_NOT_CONFIGURED", "Chưa đặt TELEGRAM_BOT_TOKEN");
    if (action === "discover") {
      const chat = await discoverTelegramChat();
      if (!chat) throw new ApiError(404, "TELEGRAM_CHAT_NOT_FOUND", "Chưa thấy tin nhắn nào gửi cho bot");
      await logEvent({ type: "traffic.telegram_chat", userId: admin.id, data: { chatId: chat.chatId } });
      return ok({ chat, telegram: await telegramStatus() });
    }
    const sent = await sendTelegram("✅ Monlabs – tin thử: cảnh báo lưu lượng sẽ gửi về đây.");
    if (!sent) throw new ApiError(502, "TELEGRAM_SEND_FAILED", "Gửi tin thử không thành công");
    return ok({ sent: true });
  });
}
