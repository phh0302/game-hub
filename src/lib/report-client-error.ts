/** Gửi lỗi giao diện (trình duyệt) về server → server chuyển lên Sentry. Không bao giờ ném lỗi. */
export function reportClientError(error: Error & { digest?: string }, where: string) {
  try {
    const body = JSON.stringify({
      message: String(error.message ?? "").slice(0, 1000),
      name: String(error.name ?? "Error").slice(0, 100),
      stack: String(error.stack ?? "").slice(0, 8000),
      digest: error.digest?.slice(0, 100),
      url: window.location.pathname.slice(0, 500),
      where,
    });
    void fetch("/api/v1/client-errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  } catch {
    // bỏ qua
  }
}
