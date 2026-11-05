import { getLocale, getTranslations } from "next-intl/server";
import { listCategories, listGames } from "@/modules/games/service";
import { GameCard } from "@/components/games/GameCard";
import { CategoryFilter } from "@/components/games/CategoryFilter";

// Luôn đọc dữ liệu mới từ database
export const dynamic = "force-dynamic";

async function loadCatalog(locale: string, category?: string) {
  try {
    const [games, categories] = await Promise.all([listGames(locale, { category }), listCategories(locale)]);
    return { games, categories, dbError: false };
  } catch (error) {
    console.error("[home] Không kết nối được database:", error);
    return { games: [], categories: [], dbError: true };
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string; category?: string }>;
}) {
  const t = await getTranslations("home");
  const tAuth = await getTranslations("auth");
  const locale = await getLocale();
  const { auth, category } = await searchParams;
  const activeCategory = category && /^[a-z0-9-]{1,50}$/.test(category) ? category : undefined;
  const { games, categories, dbError } = await loadCatalog(locale, activeCategory);

  // Bị middleware chuyển về trang chủ vì chưa đăng nhập / không phải admin
  const authNotice = auth === "required" || auth === "forbidden" ? tAuth(auth) : null;

  return (
    <>
      {authNotice && (
        <div role="status" className="border-b border-neon-pink/40 bg-neon-pink/10 px-4 py-3 text-center text-sm text-neon-pink">
          {authNotice}
        </div>
      )}
      <section className="grid-bg border-b border-line/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-xs font-semibold text-neon">
            <span className="size-1.5 rounded-full bg-neon" />
            {t("badge")}
          </span>
          <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-tight sm:text-6xl">
            {t("heroTitle")} <span className="neon-text">{t("heroHighlight")}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">{t("heroSubtitle")}</p>
          <a
            href="#games"
            className="mt-8 inline-block rounded-xl bg-linear-to-r from-neon to-neon-pink px-6 py-3 font-semibold text-bg shadow-[0_0_30px_-5px] shadow-neon/60 transition hover:brightness-110"
          >
            {t("playNow")}
          </a>
        </div>
      </section>

      <section id="games" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-bold">{t("gamesTitle")}</h2>
          {categories.length > 0 && (
            <CategoryFilter categories={categories} active={activeCategory} allLabel={t("allCategories")} />
          )}
        </div>

        {dbError && (
          <p className="mt-6 rounded-lg border border-neon-pink/40 bg-neon-pink/10 p-4 text-sm text-neon-pink">
            {t("dbError")}
          </p>
        )}

        {!dbError && games.length === 0 && (
          <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-muted">{t("noGames")}</p>
        )}

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.id} game={game} labels={{ play: t("play"), maintenance: t("maintenance") }} />
          ))}
        </div>
      </section>
    </>
  );
}
