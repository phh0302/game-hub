import { ImageResponse } from "next/og";
import { clientIp } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { pickTranslation } from "@/lib/locale";
import { formatScore, type ScoreFormat } from "@/lib/score-format";
import { prisma } from "@/lib/prisma";
import { readLeaderboardSettings } from "@/modules/games/settings";

/**
 * Ảnh xem trước khi dán link lên Facebook / Zalo / Messenger (1200x630 PNG – các mạng xã hội không nhận SVG).
 * /api/og                         → ảnh chung của hub
 * /api/og?game=2048               → ảnh của game
 * /api/og?game=2048&score=1696    → ảnh "khoe điểm"
 */
export const runtime = "nodejs";

/** Logo Monlabs (public/brand/monlabs-logo-rounded.svg) nhúng sẵn – hàm OG không đọc được thư mục public trên Vercel */
const LOGO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDI0IiBoZWlnaHQ9IjEwMjQiIHZpZXdCb3g9IjAgMCAxMjAgMTIwIj4KICA8ZGVmcz4KICAgIDxjbGlwUGF0aCBpZD0iaW5zaWRlIiBjbGlwUGF0aFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CiAgICAgIDxwYXRoIHRyYW5zZm9ybT0icm90YXRlKC0xOCA2MCA2NCkiIGQ9Ik01MyAyOHYxNGMtMTQgNi0yMiAxNi0yMiAzMCAwIDE2IDEzIDI2IDI5IDI2czI5LTEwIDI5LTI2YzAtMTQtOC0yNC0yMi0zMFYyOHoiLz4KICAgIDwvY2xpcFBhdGg+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMjgiIGZpbGw9IiMzQzM0ODkiLz4KICA8Y2lyY2xlIGN4PSIyNiIgY3k9IjIwIiByPSI1IiBmaWxsPSIjQ0VDQkY2Ii8+CiAgPGNpcmNsZSBjeD0iMTYiIGN5PSIzOCIgcj0iMy41IiBmaWxsPSIjQUZBOUVDIi8+CiAgPGNpcmNsZSBjeD0iMTAwIiBjeT0iMzAiIHI9IjMiIGZpbGw9IiNDRUNCRjYiLz4KICA8ZyBjbGlwLXBhdGg9InVybCgjaW5zaWRlKSI+CiAgICA8cGF0aCBkPSJNMjAgNzRjMTAtNSAyMCA1IDMwIDBzMjAtNSAzMCAwIDIwIDUgMzAgMFYxMjBIMjB6IiBmaWxsPSIjN0Y3N0REIi8+CiAgICA8Y2lyY2xlIGN4PSI3MCIgY3k9Ijg2IiByPSIzIiBmaWxsPSIjQ0VDQkY2Ii8+CiAgICA8Y2lyY2xlIGN4PSI2MCIgY3k9IjkyIiByPSIyIiBmaWxsPSIjQ0VDQkY2Ii8+CiAgPC9nPgogIDxnIHRyYW5zZm9ybT0icm90YXRlKC0xOCA2MCA2NCkiPgogICAgPHJlY3QgeD0iNTEiIHk9IjE2IiB3aWR0aD0iMTgiIGhlaWdodD0iMTIiIHJ4PSIzIiBmaWxsPSIjQkE3NTE3Ii8+CiAgICA8cGF0aCBkPSJNNTMgMjh2MTRjLTE0IDYtMjIgMTYtMjIgMzAgMCAxNiAxMyAyNiAyOSAyNnMyOS0xMCAyOS0yNmMwLTE0LTgtMjQtMjItMzBWMjgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI1IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CiAgICA8cmVjdCB4PSI0NyIgeT0iMzMiIHdpZHRoPSIyNiIgaGVpZ2h0PSI3IiByeD0iMy41IiBmaWxsPSIjRjA5OTdCIi8+CiAgICA8cGF0aCBkPSJNNzYgNjJhMjAgMjAgMCAwIDEgNiAxMiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjQ0VDQkY2IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDwvZz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg1NSA0OSkiPgogICAgPGNpcmNsZSByPSI3IiBmaWxsPSIjRkFDNzc1Ii8+CiAgICA8cGF0aCBkPSJNLTcgMGgxNCIgc3Ryb2tlPSIjODU0RjBCIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogICAgPGNpcmNsZSBjeT0iMyIgcj0iMS42IiBmaWxsPSIjODU0RjBCIi8+CiAgPC9nPgo8L3N2Zz4K";

const SIZE = { width: 1200, height: 630 };
const TEXT = {
  vi: { tagline: "Cổng mini game · Đăng nhập bằng ví MetaMask", challenge: "Mình đạt", points: "điểm", time: "thời gian", cta: "Vào thách đấu!", play: "Chơi ngay" },
  en: { tagline: "Mini game portal · Sign in with MetaMask", challenge: "I scored", points: "points", time: "time", cta: "Can you beat it?", play: "Play now" },
};

/** Font có dấu tiếng Việt (font mặc định của ImageResponse thiếu dấu). Lỗi mạng → dùng font mặc định */
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@800&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url, { signal: AbortSignal.timeout(3000) })).text();
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src, { signal: AbortSignal.timeout(3000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    await rateLimit(`og:${clientIp(req)}`, 60, 60_000);
  } catch {
    return new Response("Too many requests", { status: 429 });
  }

  const params = new URL(req.url).searchParams;
  const locale = params.get("locale") === "en" ? "en" : "vi";
  const t = TEXT[locale];
  const slug = params.get("game")?.slice(0, 64) ?? null;
  const rawScore = params.get("score");
  const score = rawScore && /^\d{1,12}$/.test(rawScore) ? Number(rawScore) : null;

  let title = "Game Hub";
  let subtitle: string = t.tagline;
  let scoreText: string | null = null;
  let format: ScoreFormat = "number";

  if (slug) {
    const game = await prisma.game
      .findFirst({
        where: { slug, deletedAt: null, status: { in: ["PUBLISHED", "MAINTENANCE"] } },
        include: { translations: true, leaderboards: { where: { key: "default", deletedAt: null } } },
      })
      .catch(() => null);
    if (game) {
      const tr = pickTranslation(game.translations, locale);
      title = tr?.name ?? game.slug;
      subtitle = (tr?.description ?? t.tagline).slice(0, 140);
      format = readLeaderboardSettings(game.leaderboards[0]?.settings).format ?? "number";
      if (score !== null) scoreText = formatScore(score, format, locale);
    }
  }

  const label = format === "duration_ms" ? t.time : t.points;
  const allText = `GAME HUB ${title} ${subtitle} ${t.challenge} ${scoreText ?? ""} ${label} ${t.cta} ${t.play} 0123456789:,.`;
  const font = await loadFont(allText);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#07070f",
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(34,227,255,0.28), transparent 45%), radial-gradient(circle at 85% 85%, rgba(255,62,200,0.28), transparent 45%)",
          color: "#ecebff",
          fontFamily: font ? "Hub" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="" width={44} height={44} />
          <div style={{ fontSize: 30, letterSpacing: 6, color: "#9a98c3" }}>GAME HUB</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: title.length > 18 ? 80 : 104,
              lineHeight: 1.05,
              backgroundImage: "linear-gradient(90deg, #22e3ff, #ff3ec8)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {title}
          </div>
          {scoreText ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
              <span style={{ fontSize: 40, color: "#9a98c3" }}>{t.challenge}</span>
              <span style={{ fontSize: 88, color: "#b6ff3b" }}>{scoreText}</span>
              <span style={{ fontSize: 40, color: "#9a98c3" }}>{format === "duration_ms" ? "" : label}</span>
            </div>
          ) : (
            <div style={{ fontSize: 36, color: "#9a98c3", lineHeight: 1.35, maxWidth: 1000 }}>{subtitle}</div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 30 }}>
          <span style={{ color: "#9a98c3" }}>{scoreText ? t.tagline : ""}</span>
          <span
            style={{
              padding: "14px 30px",
              borderRadius: 16,
              background: "linear-gradient(90deg, #22e3ff, #ff3ec8)",
              color: "#07070f",
            }}
          >
            {scoreText ? t.cta : t.play}
          </span>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: font ? [{ name: "Hub", data: font, weight: 800, style: "normal" }] : undefined,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
