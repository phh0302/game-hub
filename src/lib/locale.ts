import "server-only";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";

/** Ngôn ngữ cho API: ?locale=en → cookie NEXT_LOCALE → mặc định (vi) */
export async function resolveLocale(req?: Request): Promise<Locale> {
  const fromQuery = req ? new URL(req.url).searchParams.get("locale") : null;
  if (isLocale(fromQuery)) return fromQuery;
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  return isLocale(fromCookie) ? fromCookie : defaultLocale;
}

/** Chọn bản dịch theo ngôn ngữ, không có thì lấy ngôn ngữ mặc định, rồi bản bất kỳ */
export function pickTranslation<T extends { locale: string }>(items: T[], locale: string): T | undefined {
  return items.find((i) => i.locale === locale) ?? items.find((i) => i.locale === defaultLocale) ?? items[0];
}
