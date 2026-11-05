import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LeaderboardPanel } from "@/components/leaderboard/LeaderboardPanel";
import { loadGame } from "../data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("leaderboard");
  const game = await loadGame(slug, await getLocale());
  return { title: `${t("title")} ${game.name} – Game Hub` };
}

export default async function LeaderboardPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations("leaderboard");
  const game = await loadGame(slug, await getLocale());

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav className="mb-4 text-sm text-muted">
        <Link href={`/games/${game.slug}`} className="hover:text-ink">
          ← {game.name}
        </Link>
      </nav>
      <h1 className="mb-6 font-display text-3xl font-bold">
        {t("title")} · <span className="neon-text">{game.name}</span>
      </h1>
      <LeaderboardPanel slug={game.slug} limit={100} />
      <div className="mt-6 text-center">
        <Link
          href={`/games/${game.slug}`}
          className="inline-block rounded-xl bg-linear-to-r from-neon to-neon-pink px-6 py-3 font-semibold text-bg"
        >
          {t("playToRank")}
        </Link>
      </div>
    </div>
  );
}
