import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/format";
import { CONTACT_EMAIL, sendMail } from "@/lib/mail";
import { sendTelegram } from "@/lib/traffic/alerts";
import { primaryWallet } from "@/modules/users/dto";
import type { UserWithIdentities } from "@/modules/users/dto";

export const FEEDBACK_CATEGORIES = ["BUG", "IDEA", "OTHER"] as const;

export const feedbackCreateSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string().trim().min(5).max(2000),
  /** Email để admin trả lời – không bắt buộc ("" = bỏ trống) */
  email: z.union([z.literal(""), z.email().max(200)]).optional(),
  /** Trang đang xem khi gửi – chỉ giữ đường dẫn */
  page: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v.split(/[?#]/)[0] : undefined)),
  /** Ô ẩn chống bot: người thật không điền */
  website: z.string().max(200).optional(),
});

export const feedbackListQuerySchema = z.object({ status: z.enum(["OPEN", "DONE"]).default("OPEN") });
export const feedbackUpdateSchema = z.object({ status: z.enum(["OPEN", "DONE"]) });

const CATEGORY_LABEL: Record<(typeof FEEDBACK_CATEGORIES)[number], string> = { BUG: "Báo lỗi", IDEA: "Ý tưởng", OTHER: "Khác" };

/** Lưu góp ý; báo qua email admin (nếu có Resend) + Telegram (nếu có bot). Bot điền ô ẩn → bỏ qua âm thầm */
export async function createFeedback(user: UserWithIdentities | null, input: z.infer<typeof feedbackCreateSchema>) {
  if (input.website) return { id: null };
  const email = input.email || null;
  const fb = await prisma.feedback.create({
    data: { userId: user?.id ?? null, email, category: input.category, message: input.message, page: input.page ?? null },
  });

  const wallet = user ? primaryWallet(user) : null;
  const who = user ? `${displayName({ id: user.id, username: user.username, walletAddress: wallet })} (${wallet ?? user.id})` : "Khách";
  const text = [
    `Loại: ${CATEGORY_LABEL[input.category]}`,
    `Người gửi: ${who}`,
    `Email trả lời: ${email ?? "(không để lại)"}`,
    `Trang: ${input.page ?? "-"}`,
    "",
    input.message,
  ].join("\n");

  const [emailed] = await Promise.all([
    sendMail({ to: CONTACT_EMAIL, subject: `[Monlabs góp ý] ${CATEGORY_LABEL[input.category]}: ${input.message.slice(0, 60)}`, text, replyTo: email ?? undefined }),
    sendTelegram(`💬 Góp ý mới\n${text.slice(0, 1500)}`),
  ]);
  if (emailed) await prisma.feedback.update({ where: { id: fb.id }, data: { emailed: true } });
  return { id: fb.id };
}

export async function adminListFeedback(status: "OPEN" | "DONE") {
  const [items, counts] = await Promise.all([
    prisma.feedback.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { include: { identities: true } } },
    }),
    prisma.feedback.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<"OPEN" | "DONE", number>>,
    items: items.map((f) => ({
      id: f.id,
      category: f.category,
      message: f.message,
      email: f.email,
      page: f.page,
      status: f.status,
      emailed: f.emailed,
      createdAt: f.createdAt.toISOString(),
      user: f.user ? displayName({ id: f.user.id, username: f.user.username, walletAddress: primaryWallet(f.user) }) : null,
    })),
  };
}

export async function adminUpdateFeedback(id: string, status: "OPEN" | "DONE") {
  const fb = await prisma.feedback.update({ where: { id }, data: { status } });
  return { id: fb.id, status: fb.status };
}
