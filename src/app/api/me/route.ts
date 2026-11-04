import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok, readJson } from "@/lib/api";
import { requireUser, toPublicUser } from "@/lib/auth/session";

const updateSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,20}$/, "Username 3–20 ký tự: chữ, số, dấu _")
    .nullable()
    .optional(),
  avatarUrl: z.string().trim().url().max(500).nullable().optional(),
});

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok({ user: toPublicUser(user) });
  });
}

/** Cập nhật hồ sơ: { username?, avatarUrl? } — username trùng sẽ trả lỗi 409 */
export async function PATCH(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const data = updateSchema.parse(await readJson(req));
    const updated = await prisma.user.update({ where: { id: user.id }, data });
    return ok({ user: toPublicUser(updated) });
  });
}
