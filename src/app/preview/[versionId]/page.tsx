import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { gameEntryUrl } from "@/lib/assets";
import { pickTranslation } from "@/lib/locale";
import { getCurrentUser } from "@/modules/auth/session";
import { getPreviewableVersion } from "@/modules/developer/service";
import { PreviewPlayer } from "@/components/developer/PreviewPlayer";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("preview");
  return { title: `${t("title")} – Game Hub`, robots: { index: false } };
}

/** Chơi thử 1 phiên bản (kể cả chưa duyệt) – chỉ admin và thành viên studio của game */
export default async function PreviewPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const version = await getPreviewableVersion(user, versionId);
  if (!version) notFound();

  const locale = await getLocale();
  const name = pickTranslation(version.game.translations, locale)?.name ?? version.game.slug;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PreviewPlayer
        playUrl={gameEntryUrl(version)}
        gameName={name}
        version={version.version}
        status={version.status}
        studioName={version.game.studio.name}
        releaseNotes={version.releaseNotes}
      />
    </div>
  );
}
