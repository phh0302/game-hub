"use client";

import { useEffect } from "react";
import { encodeRefCookie, isInviteCode, REF_COOKIE, REF_COOKIE_MAX_AGE } from "@/modules/referrals/codes";

/**
 * Mở hub qua link mời (?ref=mã) → nhớ 30 ngày trong cookie; ví mới đăng nhập sau đó được tính cho người mời.
 * Đặt ở layout nên chạy trên mọi trang (trang chủ, trang game…).
 */
export function RefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!isInviteCode(ref)) return;
    const slug = window.location.pathname.match(/^\/games\/([a-z0-9-]+)/)?.[1] ?? null;
    document.cookie = `${REF_COOKIE}=${encodeRefCookie(ref, slug)}; path=/; max-age=${REF_COOKIE_MAX_AGE}; samesite=lax${
      window.location.protocol === "https:" ? "; secure" : ""
    }`;
  }, []);
  return null;
}
