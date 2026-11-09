"use client";

import { apiFetch, ApiClientError } from "@/lib/client-api";

type Ticket = { url: string; method: "PUT"; headers: Record<string, string>; key: string };

/**
 * Upload file thẳng lên kho lưu trữ (không qua server web):
 * 1. xin link upload ký sẵn  2. PUT file lên link đó (có báo % tiến độ)  → trả về key của file
 */
export async function uploadFile(
  file: File,
  kind: "build" | "image",
  onProgress?: (percent: number) => void,
): Promise<string> {
  // Một số trình duyệt/hệ điều hành không điền type cho file .zip
  const contentType = file.type || (kind === "build" ? "application/zip" : "application/octet-stream");
  const { upload } = await apiFetch<{ upload: Ticket }>("/developer/uploads", {
    method: "POST",
    json: { kind, contentType, size: file.size },
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(upload.method, upload.url);
    Object.entries(upload.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiClientError(xhr.status, "UPLOAD_FAILED", `Upload thất bại (${xhr.status})`));
    xhr.onerror = () => reject(new ApiClientError(0, "UPLOAD_FAILED", "Mất kết nối khi upload"));
    xhr.send(file);
  });

  onProgress?.(100);
  return upload.key;
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "–";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
