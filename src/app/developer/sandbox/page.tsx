import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SandboxPlayer } from "@/components/developer/SandboxPlayer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sandbox");
  return { title: `${t("title")} – Game Hub`, robots: { index: false } };
}

/** Sandbox cho developer: thử game đang chạy trên máy (localhost) với hub giả lập – không cần upload, không cần đăng nhập */
export default async function SandboxPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <SandboxPlayer initialUrl={typeof url === "string" && url.length < 500 ? url : "http://localhost:5173"} />
    </div>
  );
}
