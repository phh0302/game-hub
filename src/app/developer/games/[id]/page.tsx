import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DeveloperGame } from "@/components/developer/DeveloperGame";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("developer");
  return { title: `${t("title")} – Game Hub` };
}

export default async function DeveloperGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <DeveloperGame gameId={id} />
    </div>
  );
}
