import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StatsGate } from "@/components/admin/StatsGate";

// stats.monlabs.fun → middleware chuyển "/" về trang này. Chỉ admin xem được số liệu (API tự kiểm tra quyền).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("trafficStats");
  return { title: `${t("title")} – Monlabs`, robots: { index: false, follow: false } };
}

export default function StatsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <StatsGate />
    </div>
  );
}
