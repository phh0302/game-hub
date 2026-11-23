/**
 * Gửi email qua Resend (https://resend.com) bằng HTTP – không cần thư viện.
 * Chưa đặt RESEND_API_KEY → không gửi (trả false), nơi gọi vẫn lưu dữ liệu bình thường.
 */
import { log } from "./log";

export const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "admin@monlabs.fun";

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(input: { to: string; subject: string; text: string; replyTo?: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.MAIL_FROM || "Monlabs <noreply@monlabs.fun>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject.slice(0, 200),
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) log.warn("mail.send_failed", { area: "mail", status: res.status, body: (await res.text()).slice(0, 300) });
    return res.ok;
  } catch (err) {
    log.warn("mail.send_failed", { area: "mail", error: err });
    return false;
  }
}
