import { z } from "zod";
import { handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { createUploadTicket } from "@/modules/developer/service";

const schema = z.object({ contentType: z.string().max(100), size: z.number().int().positive() });

/**
 * Xin link upload ảnh đại diện (ai đã kết nối ví cũng dùng được, không cần là developer).
 * Body: { contentType, size } → { upload: { url, method, headers, key } }; sau đó PATCH /me { avatarKey: key }
 */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    await rateLimit(`avatar:${user.id}`, 10, 60 * 60_000);
    const input = schema.parse(await readJson(req));
    return ok({ upload: await createUploadTicket(user.id, { kind: "image", ...input }) });
  });
}
