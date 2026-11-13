import { defineConfig } from "vitepress";

const HUB = "https://play.monlabs.fun";

// Tài liệu cho developer đăng game lên Game Hub: tiếng Việt ở gốc, tiếng Anh ở /en/
// (cùng tên file để nút đổi ngôn ngữ chuyển đúng trang).
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
  locales: {
    root: { label: "Tiếng Việt", lang: "vi-VN" },
    en: {
      label: "English",
      lang: "en-US",
      description: "How to publish an HTML5 game on Game Hub: preparing files, the Game Hub SDK, leaderboards and review.",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/en/bat-dau", activeMatch: "^/en/(bat-dau|chuan-bi-zip|moi-truong|studio)" },
          { text: "SDK", link: "/en/sdk", activeMatch: "^/en/(sdk|bang-xep-hang|ngoai-hub|server-api|giao-thuc)" },
          { text: "Game Hub", link: HUB },
          { text: "monlabs.fun", link: "https://monlabs.fun" },
        ],
        sidebar: [
          {
            text: "Guide",
            items: [
              { text: "Getting started", link: "/en/bat-dau" },
              { text: "Prepare the .zip", link: "/en/chuan-bi-zip" },
              { text: "Runtime environment", link: "/en/moi-truong" },
              { text: "Studio & review", link: "/en/studio" },
            ],
          },
          {
            text: "Reference",
            items: [
              { text: "Game Hub SDK", link: "/en/sdk" },
              { text: "Leaderboards & anti-cheat", link: "/en/bang-xep-hang" },
              { text: "Outside Game Hub (Platform API)", link: "/en/ngoai-hub" },
              { text: "Server API & webhooks", link: "/en/server-api" },
              { text: "postMessage protocol", link: "/en/giao-thuc" },
              { text: "Terms", link: "/en/dieu-khoan" },
            ],
          },
        ],
        outline: { level: [2, 3], label: "On this page" },
        docFooter: { prev: "Previous", next: "Next" },
        returnToTopLabel: "Back to top",
        sidebarMenuLabel: "Menu",
        darkModeSwitchLabel: "Appearance",
        lightModeSwitchTitle: "Switch to light theme",
        darkModeSwitchTitle: "Switch to dark theme",
        langMenuLabel: "Language",
        notFound: {
          title: "PAGE NOT FOUND",
          quote: "This page doesn't exist or has moved.",
          linkLabel: "Go to home",
          linkText: "Go to home",
        },
        footer: {
          message: `Questions? Send a report right on the game page at <a href="${HUB}">Game Hub</a>.`,
          copyright: "© 2026 Monlabs",
        },
      },
    },
  },
  themeConfig: {
    logo: "/logo.png",
    siteTitle: "Monlabs Docs",
    nav: [
      { text: "Hướng dẫn", link: "/bat-dau", activeMatch: "^/(bat-dau|chuan-bi-zip|moi-truong|studio)" },
      { text: "SDK", link: "/sdk", activeMatch: "^/(sdk|bang-xep-hang|ngoai-hub|server-api|giao-thuc)" },
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
          { text: "Dùng ngoài Game Hub (Platform API)", link: "/ngoai-hub" },
          { text: "Server API & webhook", link: "/server-api" },
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
        locales: {
          en: {
            translations: {
              button: { buttonText: "Search", buttonAriaLabel: "Search" },
              modal: {
                displayDetails: "Show details",
                resetButtonTitle: "Clear query",
                backButtonTitle: "Close",
                noResultsText: "No results for",
                footer: { selectText: "select", navigateText: "navigate", closeText: "close" },
              },
            },
          },
        },
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
