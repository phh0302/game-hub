import Link from "next/link";
import type { GameDto } from "@/modules/games/dto";

export function GameCard({
  game,
  labels,
}: {
  game: GameDto;
  labels: { play: string; maintenance: string };
}) {
  const playable = game.status === "PUBLISHED" && game.playUrl;

  return (
    <Link
      href={`/games/${game.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-neon/60 focus-visible:outline-2 focus-visible:outline-neon"
    >
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        {game.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.thumbnailUrl}
            alt=""
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        )}
        {!playable && (
          <span className="absolute left-3 top-3 rounded-md bg-bg/80 px-2 py-1 text-xs font-semibold text-neon-pink">
            {labels.maintenance}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold">{game.name}</h3>
          <div className="flex flex-wrap justify-end gap-1">
            {game.categories.map((c) => (
              <span key={c.slug} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
                {c.name}
              </span>
            ))}
          </div>
        </div>
        {game.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{game.description}</p>}
        <span className="mt-auto pt-4 text-sm font-semibold text-neon group-hover:underline">{labels.play} →</span>
      </div>
    </Link>
  );
}
