import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { CONTACT_EMAIL } from "@/lib/mail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return { title: `${t("title")} – Game Hub`, description: t("intro") };
}

/** Góp ý & liên hệ – công khai, khách cũng gửi được */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const t = await getTranslations("contact");
  const { from } = await searchParams;
  const page = typeof from === "string" && from.startsWith("/") ? from.slice(0, 300) : undefined;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-muted">{t("intro")}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("mailTitle")}</p>
          <p className="text-sm text-muted">{t("mailBody")}</p>
        </div>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          data-testid="contact-email"
          className="rounded-lg border border-neon/50 px-4 py-2 font-mono text-sm text-neon hover:bg-neon/10"
        >
          {CONTACT_EMAIL}
        </a>
      </div>

      <h2 className="mt-8 mb-3 font-display text-xl font-semibold">{t("formTitle")}</h2>
      <FeedbackForm from={page} />
    </div>
  );
}
