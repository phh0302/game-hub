import type { Instrumentation } from "next";
import { reportError } from "@/lib/monitoring";

export function register() {
  // Không cần khởi tạo gì: lỗi được gửi đi bằng fetch trong onRequestError
}

/** Next.js gọi hàm này khi trang / route / middleware ném lỗi chưa được xử lý */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  await reportError(err, {
    request: { method: request.method, url: request.path },
    tags: {
      area: "next",
      routerKind: context.routerKind,
      routeType: context.routeType,
      routePath: context.routePath,
    },
    extra: { digest: (err as { digest?: string }).digest },
  });
};
