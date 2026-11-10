import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Chakra_Petch } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { getCurrentUser } from "@/modules/auth/session";
import { toPublicUser } from "@/modules/users/dto";
import "./globals.css";

// Cả 2 font đều hỗ trợ tiếng Việt
const body = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const display = Chakra_Petch({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#07070f",
  colorScheme: "dark",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  const locale = await getLocale();
  return {
    // URL tuyệt đối cho ảnh / link chia sẻ (Facebook, Zalo cần link đầy đủ)
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    title: t("title"),
    description: t("description"),
    applicationName: "Game Hub",
    // Mở từ màn hình chính iPhone: toàn màn hình, thanh trạng thái tối
    appleWebApp: { capable: true, title: "Game Hub", statusBarStyle: "black-translucent" },
    openGraph: {
      type: "website",
      siteName: "Game Hub",
      title: t("title"),
      description: t("description"),
      locale: locale === "vi" ? "vi_VN" : "en_US",
      images: [{ url: `/api/og?locale=${locale}`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  // Lỗi DB (vd: Docker chưa chạy) không được làm sập toàn bộ trang
  const user = await getCurrentUser().catch(() => null);

  return (
    <html lang={locale} className={`${body.variable} ${display.variable}`}>
      <body className="min-h-dvh flex flex-col font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider initialUser={user ? toPublicUser(user) : null}>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
