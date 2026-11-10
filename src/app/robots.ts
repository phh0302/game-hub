import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/og"],
      // Trang cá nhân / quản trị / API không cần lên Google
      disallow: ["/api/", "/admin", "/developer", "/preview", "/profile"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
