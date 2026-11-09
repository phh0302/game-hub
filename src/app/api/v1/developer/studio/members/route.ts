import { handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireRegisteredUser } from "@/modules/auth/session";
import { addMember, listMembers, requireMyStudio } from "@/modules/developer/service";
import { memberAddSchema } from "@/modules/developer/schemas";

export async function GET() {
  return handle(async () => {
    const user = await requireRegisteredUser();
    const studio = await requireMyStudio(user.id);
    return ok({ members: await listMembers(studio.id) });
  });
}

/** Chủ studio thêm thành viên. Body: { walletAddress: "0x..." } */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireRegisteredUser();
    rateLimit(`member:${user.id}`, 20, 60 * 60_000);
    const input = memberAddSchema.parse(await readJson(req));
    return ok({ members: await addMember(user.id, input) }, { status: 201 });
  });
}
