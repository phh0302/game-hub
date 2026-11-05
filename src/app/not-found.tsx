import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="mx-auto grid max-w-xl place-items-center gap-4 px-4 py-24 text-center">
      <p className="font-display text-6xl font-bold neon-text">404</p>
      <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted">{t("text")}</p>
      <Link href="/" className="rounded-xl border border-neon/60 px-5 py-2.5 font-semibold text-neon hover:bg-neon/10">
        {t("home")}
      </Link>
    </div>
  );
}
