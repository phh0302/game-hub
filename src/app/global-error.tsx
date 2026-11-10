"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

/** Lỗi ở layout gốc (không còn giao diện / bản dịch) → trang tối giản song ngữ */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, "global");
  }, [error]);

  return (
    <html lang="vi">
      <body style={{ background: "#07070f", color: "#ecebff", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "80px 16px" }}>
        <h1>Đã có lỗi xảy ra · Something went wrong</h1>
        {error.digest && <p style={{ opacity: 0.6, fontFamily: "monospace", fontSize: 12 }}>{error.digest}</p>}
        <button type="button" onClick={reset} style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}>
          Thử lại · Try again
        </button>
      </body>
    </html>
  );
}
