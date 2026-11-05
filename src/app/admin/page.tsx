import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

// Middleware đã chặn người không phải admin; API admin cũng tự kiểm tra quyền
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: `${t("title")} – Game Hub` };
}

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminDashboard />
    </div>
  );
}
