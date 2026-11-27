import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { PRIVACY } from "@/content/privacy";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: `${PRIVACY[locale === "en" ? "en" : "vi"].title} – Game Hub` };
}

/** Chính sách quyền riêng tư cho người chơi – công khai, có mục quảng cáo Google (AdSense yêu cầu) */
export default async function PrivacyPage() {
  const locale = await getLocale();
  const p = PRIVACY[locale === "en" ? "en" : "vi"];
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{p.title}</h1>
      <p className="mt-1 text-xs text-muted">
        {locale === "en" ? "Updated" : "Cập nhật"}: {p.updated}
      </p>
      <p className="mt-6 text-muted">{p.intro}</p>
      {p.sections.map((s) => (
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
