import { handle, ok } from "@/lib/api";
import { findVisibleGame } from "@/lib/games";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await params;
    const game = await findVisibleGame(slug);
    return ok({ game });
  });
}
