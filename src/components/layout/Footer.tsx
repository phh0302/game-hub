import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/mail";
import { InstallApp } from "./InstallApp";

export async function Footer() {
  const t = await getTranslations("footer");
  return (
    <footer className="flex flex-col items-center gap-3 border-t border-line/70 py-6 text-center text-xs text-muted">
      <InstallApp />
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link href="/contact" className="font-semibold text-ink hover:text-neon">
          {t("feedback")}
        </Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-neon">
          {CONTACT_EMAIL}
        </a>
      </nav>
      <span>{t("rights", { year: new Date().getFullYear() })}</span>
    </footer>
  );
}
