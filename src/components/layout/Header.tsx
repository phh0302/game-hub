import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "./LanguageSwitcher";

export async function Header() {
  const t = await getTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-wide">
          <span className="grid size-8 place-items-center rounded-lg bg-linear-to-br from-neon to-neon-pink text-bg">
            G
          </span>
          <span>
            GAME<span className="neon-text">HUB</span>
          </span>
        </Link>

        <nav className="ml-6 hidden gap-5 text-sm text-muted sm:flex">
          <Link href="/" className="hover:text-ink">
            {t("home")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher label={t("language")} />
          {/* Nút kết nối ví – sẽ hoạt động ở Phase 3 */}
          <button
            type="button"
            disabled
            className="rounded-lg border border-neon/60 px-4 py-2 text-sm font-semibold text-neon opacity-60"
          >
            {t("connectWallet")}
          </button>
        </div>
      </div>
    </header>
  );
}
