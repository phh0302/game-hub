import type { MetadataRoute } from "next";

/** Cho phép "Thêm vào màn hình chính" / cài như app trên điện thoại và máy tính */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Game Hub – Cổng mini game",
    short_name: "Game Hub",
    description: "Chơi mini game miễn phí, đăng nhập bằng ví MetaMask và leo bảng xếp hạng.",
    lang: "vi",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#07070f",
    theme_color: "#07070f",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
