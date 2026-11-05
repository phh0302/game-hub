import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { GameRoom } from "@/components/games/GameRoom";
import { loadGame } from "./data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = await loadGame(slug, await getLocale());
  return { title: `${game.name} – Game Hub`, description: game.description ?? undefined };
}

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations("game");
  const game = await loadGame(slug, await getLocale());
  const playable = game.status === "PUBLISHED" ? game.playUrl : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          {t("back")}
        </Link>
      </nav>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{game.name}</h1>
          {game.description && <p className="mt-2 max-w-2xl text-muted">{game.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted">
          {game.categories.map((c) => (
            <Link key={c.slug} href={`/?category=${c.slug}#games`} className="rounded-md bg-surface-2 px-2 py-1 hover:text-ink">
              {c.name}
            </Link>
          ))}
          {game.version && <span className="rounded-md border border-line px-2 py-1">v{game.version}</span>}
          <span className="rounded-md border border-line px-2 py-1">{game.studio.name}</span>
        </div>
      </header>

      <GameRoom slug={game.slug} playUrl={playable} gameName={game.name} />
    </div>
  );
}
