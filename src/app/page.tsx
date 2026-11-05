import { getLocale, getTranslations } from "next-intl/server";
import { listGames } from "@/modules/games/service";

// Luôn đọc dữ liệu mới từ database
export const dynamic = "force-dynamic";

async function getGames(locale: string) {
  try {
    return { games: await listGames(locale), dbError: false };
  } catch (error) {
    console.error("[home] Không kết nối được database:", error);
    return { games: [], dbError: true };
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const t = await getTranslations("home");
  const tAuth = await getTranslations("auth");
  const locale = await getLocale();
  const { games, dbError } = await getGames(locale);
  // Bị middleware chuyển về trang chủ vì chưa đăng nhập / không phải admin
  const { auth } = await searchParams;
  const authNotice = auth === "required" || auth === "forbidden" ? tAuth(auth) : null;

  return (
    <>
      {authNotice && (
        <div role="status" className="border-b border-neon-pink/40 bg-neon-pink/10 px-4 py-3 text-center text-sm text-neon-pink">
          {authNotice}
        </div>
      )}
      <section className="grid-bg border-b border-line/50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
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

      <section id="games" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="font-display text-2xl font-bold">{t("gamesTitle")}</h2>

        {dbError && (
          <p className="mt-6 rounded-lg border border-neon-pink/40 bg-neon-pink/10 p-4 text-sm text-neon-pink">
            {t("dbError")}
          </p>
        )}

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => {
            const { name, description } = game;
            return (
              <article
                key={game.id}
                className="group overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-neon/60"
              >
                <div className="aspect-video bg-surface-2">
                  {game.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={game.thumbnailUrl} alt={name} className="size-full object-cover" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold">{name}</h3>
                    <div className="flex flex-wrap justify-end gap-1">
                      {game.categories.map((c) => (
                        <span key={c.slug} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {description && <p className="mt-2 text-sm text-muted">{description}</p>}
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-neon-lime">
                    {t("comingSoon")}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
