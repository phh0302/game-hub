import { getTranslations } from "next-intl/server";
import { InstallApp } from "./InstallApp";

export async function Footer() {
  const t = await getTranslations("footer");
  return (
    <footer className="flex flex-col items-center gap-3 border-t border-line/70 py-6 text-center text-xs text-muted">
      <InstallApp />
      <span>{t("rights", { year: new Date().getFullYear() })}</span>
    </footer>
  );
}
