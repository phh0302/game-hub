/*
 * Service worker của Game Hub – giữ ĐƠN GIẢN, không làm hỏng dữ liệu đang chạy:
 * - File tĩnh của Next (/_next/static/, có mã băm trong tên) → lưu cache, lần sau mở nhanh
 * - Trang (điều hướng) → luôn lấy từ mạng; mất mạng thì hiện trang offline.html
 * - API, game (/uploads), file upload → KHÔNG đụng tới (luôn đi thẳng ra mạng)
 * Đổi VERSION khi sửa file này để xóa cache cũ.
 */
const VERSION = "v1";
const STATIC_CACHE = `gh-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("gh-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
  }
});
