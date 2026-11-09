import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { DEVELOPER_TERMS } from "@/content/developer-terms";
import { DEVELOPER_TERMS_VERSION } from "@/modules/developer/terms";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: `${DEVELOPER_TERMS[locale === "en" ? "en" : "vi"].title} – Game Hub` };
}

/** Trang công khai – ai cũng đọc được trước khi đăng ký làm developer */
export default async function DeveloperTermsPage() {
  const locale = await getLocale();
  const terms = DEVELOPER_TERMS[locale === "en" ? "en" : "vi"];
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{terms.title}</h1>
      <p className="mt-1 text-xs text-muted">
        {locale === "en" ? "Version" : "Phiên bản"}: {DEVELOPER_TERMS_VERSION}
      </p>
      <p className="mt-6 text-muted">{terms.intro}</p>
      {terms.sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="font-display text-xl font-semibold">{s.heading}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted marker:text-neon">
            {s.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
