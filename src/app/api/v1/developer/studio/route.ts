import { handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { createStudio, getMyStudio } from "@/modules/developer/service";
import { studioCreateSchema } from "@/modules/developer/schemas";

/** Studio của tôi (null nếu chưa đăng ký làm developer) */
export async function GET() {
  return handle(async () => {
    const user = await requireRegisteredUser();
    return ok({ studio: await getMyStudio(user.id) });
  });
}

/** Đăng ký làm developer = tạo studio. Body: { name, slug, description? } */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    await rateLimit(`studio:${user.id}`, 5, 60 * 60_000);
    const input = studioCreateSchema.parse(await readJson(req));
    return ok({ studio: await createStudio(user.id, input) }, { status: 201 });
  });
}
