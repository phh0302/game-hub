import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getVisibleGame } from "@/modules/games/service";
import { toGameDto } from "@/modules/games/dto";

/** Game theo slug cho trang – không có thì trả 404 */
export const loadGame = cache(async (slug: string, locale: string) => {
  try {
    return toGameDto(await getVisibleGame(slug), locale);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
});
