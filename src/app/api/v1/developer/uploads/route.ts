import { handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { assertTermsAccepted, createUploadTicket, requireMyStudio } from "@/modules/developer/service";
import { uploadRequestSchema } from "@/modules/developer/schemas";

/**
 * Xin link upload. Body: { kind: "build" | "image", contentType, size }
 * → { url, method, headers, key } – trình duyệt PUT file thẳng lên url này.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    assertTermsAccepted(await requireMyStudio(user.id));
    await rateLimit(`upload:${user.id}`, 30, 60 * 60_000);
    const input = uploadRequestSchema.parse(await readJson(req));
    return ok({ upload: await createUploadTicket(user.id, input) });
  });
}
