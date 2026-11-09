import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Game của bên thứ ba bị ép chạy trong sandbox NGAY CẢ KHI mở trực tiếp file
 * (không qua iframe của hub): trình duyệt coi game là origin "null" → không đọc được
 * cookie đăng nhập, không gọi được API dưới danh nghĩa người chơi.
 * Khi chuyển game sang domain riêng: đổi 'self' trong frame-ancestors thành domain của hub.
 */
const GAME_CSP = ["sandbox allow-scripts allow-pointer-lock", "frame-ancestors 'self'", "object-src 'none'"].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Hub không dùng next/image → tắt bộ tối ưu ảnh (không gọi tới sharp/libvips)
  images: { unoptimized: true },
  async headers() {
    return [
      {
        // Header chung cho mọi trang
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
      {
        // Trang của hub không được nhúng vào web khác (chống clickjacking khi ký ví)
        source: "/((?!uploads/games/).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
      {
        // File game: chỉ hub được nhúng + luôn chạy trong sandbox
        source: "/uploads/games/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: GAME_CSP },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
