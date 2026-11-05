import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileView } from "@/components/profile/ProfileView";

// Trang này đã được middleware chặn nếu chưa đăng nhập
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: `${t("title")} – Game Hub` };
}

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ProfileView />
    </div>
  );
}
