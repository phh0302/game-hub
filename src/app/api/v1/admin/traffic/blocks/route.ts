import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/session";
import { listBlockedIps, unblockIp } from "@/lib/traffic/guard";
import { logEvent } from "@/modules/events/service";

/** Admin: các IP đang bị chặn tạm vì gửi request dồn dập */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok({ blocks: await listBlockedIps() });
  });
}

const ipSchema = z.string().trim().min(1).max(64);

/** Admin: bỏ chặn 1 IP (?ip=) */
export async function DELETE(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const ip = ipSchema.parse(new URL(req.url).searchParams.get("ip"));
    const removed = await unblockIp(ip);
    await logEvent({ type: "traffic.unblock", userId: admin.id, data: { ip, removed } });
    return ok({ removed });
  });
}
