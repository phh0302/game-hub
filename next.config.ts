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
        source: "/((?!uploads/).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
      {
        // Service worker phải luôn lấy bản mới nhất (trình duyệt tự kiểm tra cập nhật)
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        // Mọi file trong /uploads (game chính thức + file developer upload khi chạy local):
        // chỉ hub được nhúng + luôn chạy trong sandbox → file HTML/SVG lạ không chạm được cookie của hub
        source: "/uploads/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: GAME_CSP },
        ],
      },
      // Bản build Unity nén sẵn (.br/.gz) đã được hub giải nén khi upload, nhưng vẫn giữ tên cũ →
      // khai báo đúng Content-Type theo file bên trong (khi chạy kho local; R2 tự lưu Content-Type lúc upload)
      ...[
        ["js", "text/javascript; charset=utf-8"],
        ["wasm", "application/wasm"],
        ["data", "application/octet-stream"],
        ["symbols\\.json", "application/json"],
      ].flatMap(([ext, type]) =>
        ["br", "gz"].map((enc) => ({
          source: `/uploads/:path(.*\\.${ext}\\.${enc})`,
          headers: [{ key: "Content-Type", value: type }],
        })),
      ),
    ];
  },
};

export default withNextIntl(nextConfig);
