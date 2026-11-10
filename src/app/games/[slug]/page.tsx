import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { GameRoom } from "@/components/games/GameRoom";
import { getBoardFormat } from "@/modules/scores/leaderboard";
import { formatScore } from "@/lib/score-format";
import { loadGame } from "./data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ score?: string }> };

/** Link chia sẻ /games/2048?score=1696 → ảnh xem trước "khoe điểm" trên Facebook / Zalo */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { score } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("share");
  const game = await loadGame(slug, locale);
  const validScore = score && /^\d{1,12}$/.test(score) ? Number(score) : null;

  const title = `${game.name} – Game Hub`;
  let description = game.description ?? undefined;
  const og = new URLSearchParams({ game: game.slug, locale });
  if (validScore !== null) {
    const format = await getBoardFormat(game.id);
    description = t(format === "duration_ms" ? "ogScoreTime" : "ogScore", {
      score: formatScore(validScore, format, locale),
      game: game.name,
    });
    og.set("score", String(validScore));
  }

  return {
    title,
    description,
    alternates: { canonical: `/games/${game.slug}` },
    openGraph: {
      type: "website",
      siteName: "Game Hub",
      title: validScore !== null ? description : title,
      description: validScore !== null ? game.description ?? undefined : description,
      url: `/games/${game.slug}`,
      images: [{ url: `/api/og?${og}`, width: 1200, height: 630, alt: game.name }],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations("game");
  const game = await loadGame(slug, await getLocale());
  const playable = game.status === "PUBLISHED" ? game.playUrl : null;
  const scoreFormat = await getBoardFormat(game.id);

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

      <GameRoom slug={game.slug} playUrl={playable} gameName={game.name} scoreFormat={scoreFormat} />
    </div>
  );
}
