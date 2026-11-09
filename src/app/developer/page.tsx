import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DeveloperHome } from "@/components/developer/DeveloperHome";

// Middleware đã chặn nếu chưa đăng nhập
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("developer");
  return { title: `${t("title")} – Game Hub` };
}

export default function DeveloperPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <DeveloperHome />
    </div>
  );
}
