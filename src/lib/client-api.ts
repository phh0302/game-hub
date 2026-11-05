/** Gọi API /api/v1 từ trình duyệt – lỗi trả về dạng ApiClientError có `code` để dịch */

export const API_BASE = "/api/v1";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(res.status, data?.error?.code ?? "UNKNOWN", data?.error?.message);
  }
  return data as T;
}

export function errorCode(err: unknown): string {
  return err instanceof ApiClientError ? err.code : "UNKNOWN";
}
