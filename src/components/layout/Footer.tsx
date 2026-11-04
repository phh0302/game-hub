import { getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations("footer");
  return (
    <footer className="border-t border-line/70 py-6 text-center text-xs text-muted">
      {t("rights", { year: new Date().getFullYear() })}
    </footer>
  );
}
