import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

// Đọc danh sách game mỗi lần được gọi (không tạo sẵn lúc build – lúc build có thể chưa có database)
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/terms/developer`, changeFrequency: "yearly", priority: 0.2 },
  ];
  try {
    const games = await prisma.game.findMany({
      where: { status: "PUBLISHED", deletedAt: null, currentVersionId: { not: null } },
      select: { slug: true, updatedAt: true },
      orderBy: { sortOrder: "asc" },
    });
    for (const g of games) {
      pages.push({ url: `${base}/games/${g.slug}`, lastModified: g.updatedAt, changeFrequency: "weekly", priority: 0.8 });
      pages.push({ url: `${base}/games/${g.slug}/leaderboard`, changeFrequency: "daily", priority: 0.5 });
    }
  } catch {
    // Database lỗi → vẫn trả các trang cố định
  }
  return pages;
}
