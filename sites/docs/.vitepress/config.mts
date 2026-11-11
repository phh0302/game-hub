import { defineConfig } from "vitepress";

const HUB = "https://play.monlabs.fun";

// Tài liệu cho developer đăng game lên Game Hub. Hiện chỉ có tiếng Việt;
// tiếng Anh sẽ thêm vào `locales.en` (thư mục /en/) sau.
export default defineConfig({
  lang: "vi-VN",
  title: "Monlabs Docs",
  titleTemplate: ":title · Monlabs Docs",
  description: "Hướng dẫn đưa game HTML5 lên Game Hub: chuẩn bị file, Game Hub SDK, bảng xếp hạng và quy trình duyệt.",
  cleanUrls: true,
  lastUpdated: false,
  appearance: "dark",
  sitemap: { hostname: "https://docs.monlabs.fun" },
  head: [
    ["link", { rel: "icon", type: "image/png", href: "/favicon.png" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    ["link", { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" }],
    ["meta", { name: "theme-color", content: "#08070d" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "Monlabs Docs" }],
    ["meta", { property: "og:image", content: `${HUB}/api/og?locale=vi` }],
  ],
  themeConfig: {
    logo: "/logo.png",
    siteTitle: "Monlabs Docs",
    nav: [
      { text: "Hướng dẫn", link: "/bat-dau", activeMatch: "^/(bat-dau|chuan-bi-zip|moi-truong|studio)" },
      { text: "SDK", link: "/sdk", activeMatch: "^/(sdk|bang-xep-hang|giao-thuc)" },
      { text: "Game Hub", link: HUB },
      { text: "monlabs.fun", link: "https://monlabs.fun" },
    ],
    sidebar: [
      {
        text: "Hướng dẫn",
        items: [
          { text: "Bắt đầu", link: "/bat-dau" },
          { text: "Chuẩn bị file .zip", link: "/chuan-bi-zip" },
          { text: "Môi trường chạy game", link: "/moi-truong" },
          { text: "Studio & duyệt game", link: "/studio" },
        ],
      },
      {
        text: "Tham khảo",
        items: [
          { text: "Game Hub SDK", link: "/sdk" },
          { text: "Bảng xếp hạng & chống gian lận", link: "/bang-xep-hang" },
          { text: "Giao thức postMessage", link: "/giao-thuc" },
          { text: "Điều khoản", link: "/dieu-khoan" },
        ],
      },
    ],
    outline: { level: [2, 3], label: "Trên trang này" },
    docFooter: { prev: "Trang trước", next: "Trang sau" },
    returnToTopLabel: "Lên đầu trang",
    sidebarMenuLabel: "Mục lục",
    darkModeSwitchLabel: "Giao diện",
    lightModeSwitchTitle: "Chuyển sang giao diện sáng",
    darkModeSwitchTitle: "Chuyển sang giao diện tối",
    langMenuLabel: "Ngôn ngữ",
    notFound: {
      title: "KHÔNG TÌM THẤY TRANG",
      quote: "Trang này không có hoặc đã được đổi địa chỉ.",
      linkLabel: "Về trang đầu",
      linkText: "Về trang đầu",
    },
    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "Tìm kiếm", buttonAriaLabel: "Tìm kiếm" },
          modal: {
            displayDetails: "Hiện chi tiết",
            resetButtonTitle: "Xóa từ khóa",
            backButtonTitle: "Đóng",
            noResultsText: "Không có kết quả cho",
            footer: { selectText: "chọn", navigateText: "di chuyển", closeText: "đóng" },
          },
        },
      },
    },
    footer: {
      message: `Có thắc mắc? Gửi báo cáo ngay trên trang game ở <a href="${HUB}">Game Hub</a>.`,
      copyright: "© 2026 Monlabs",
    },
  },
});
