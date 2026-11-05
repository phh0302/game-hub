import Link from "next/link";

export function CategoryFilter({
  categories,
  active,
  allLabel,
}: {
  categories: { slug: string; name: string }[];
  active?: string;
  allLabel: string;
}) {
  const chip = (selected: boolean) =>
    `shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
      selected
        ? "border-neon bg-neon/15 text-neon"
        : "border-line text-muted hover:border-neon/50 hover:text-ink"
    }`;

  return (
    <nav aria-label="Categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      <Link href="/#games" scroll={false} className={chip(!active)} aria-current={!active ? "page" : undefined}>
        {allLabel}
      </Link>
      {categories.map((c) => (
        <Link
          key={c.slug}
          href={`/?category=${c.slug}#games`}
          scroll={false}
          className={chip(active === c.slug)}
          aria-current={active === c.slug ? "page" : undefined}
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
