import { clientIp, handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/modules/auth/session";
import { createFeedback, feedbackCreateSchema } from "@/modules/feedback/service";

/** Góp ý / liên hệ (khách cũng gửi được). Body: { category: "BUG"|"IDEA"|"OTHER", message, email?, page? } */
export async function POST(req: Request) {
  return handle(async () => {
    await rateLimit(`feedback:${clientIp(req)}`, 5, 60 * 60_000);
    const input = feedbackCreateSchema.parse(await readJson(req));
    const user = await getCurrentUser();
    return ok({ feedback: await createFeedback(user, input) }, { status: 201 });
  });
}
