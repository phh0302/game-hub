// Hàm thuần (không import alias / server-only) – dùng được trong unit test và ở client

/** Cookie giữ link mời khi người chơi chưa có tài khoản: "<mã>.<slug game>" (slug có thể trống) */
export const REF_COOKIE = "gh_ref";
export const REF_COOKIE_MAX_AGE = 30 * 24 * 3600;

const CODE_RE = /^[a-z0-9]{6,12}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // bỏ ký tự dễ nhầm (0/o, 1/l/i)

export function isInviteCode(value: unknown): value is string {
  return typeof value === "string" && CODE_RE.test(value);
}

/** Mã mời ngẫu nhiên 8 ký tự */
export function newInviteCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return [...random(8)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function encodeRefCookie(code: string, slug?: string | null): string {
  return slug && SLUG_RE.test(slug) ? `${code}.${slug}` : code;
}

/** Đọc cookie mời; sai định dạng → null */
export function parseRefCookie(value: string | null | undefined): { code: string; slug: string | null } | null {
  if (!value) return null;
  const [code, slug] = decodeURIComponent(value).split(".", 2);
  if (!isInviteCode(code)) return null;
  return { code, slug: slug && SLUG_RE.test(slug) ? slug : null };
}

/** Link mời: trang game (hoặc trang chủ) + ?ref=mã. Có điểm → thêm ?score= để ảnh chia sẻ hiện "Mình đạt X điểm" */
export function inviteUrl(origin: string, options: { slug?: string | null; code?: string | null; score?: number | null }): string {
  const url = new URL(options.slug ? `/games/${options.slug}` : "/", origin);
  if (options.score !== undefined && options.score !== null && Number.isFinite(options.score)) {
    url.searchParams.set("score", String(Math.floor(options.score)));
  }
  if (options.code && isInviteCode(options.code)) url.searchParams.set("ref", options.code);
  return url.toString();
}
