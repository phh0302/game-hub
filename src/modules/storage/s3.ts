import "server-only";
import { AwsClient } from "aws4fetch";
import { isSafeKey } from "./keys";
import type { StorageDriver, UploadTicket } from "./types";

/**
 * Kho lưu trữ chuẩn S3: Cloudflare R2 (khuyên dùng – không tính phí băng thông), AWS S3, MinIO…
 * Cần: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (S3_REGION mặc định "auto" cho R2)
 */
function config() {
  const endpoint = process.env.S3_ENDPOINT?.replace(/\/+$/, "");
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Thiếu cấu hình S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY");
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey, region: process.env.S3_REGION || "auto" };
}

let cached: { client: AwsClient; base: string } | null = null;
function s3() {
  if (!cached) {
    const c = config();
    cached = {
      client: new AwsClient({ accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, service: "s3", region: c.region }),
      base: `${c.endpoint}/${c.bucket}`,
    };
  }
  return cached;
}

function objectUrl(key: string) {
  if (!isSafeKey(key)) throw new Error(`Key không hợp lệ: ${key}`);
  return `${s3().base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function ensureOk(res: Response, action: string) {
  if (!res.ok) throw new Error(`S3 ${action} thất bại: ${res.status} ${await res.text().catch(() => "")}`);
}

export const s3StorageDriver: StorageDriver = {
  name: "s3",

  async put(key, body, contentType) {
    const res = await s3().client.fetch(objectUrl(key), {
      method: "PUT",
      body,
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
    });
    await ensureOk(res, `PUT ${key}`);
  },

  async get(key) {
    const res = await s3().client.fetch(objectUrl(key));
    if (res.status === 404) return null;
    await ensureOk(res, `GET ${key}`);
    return new Uint8Array(await res.arrayBuffer());
  },

  async delete(key) {
    const res = await s3().client.fetch(objectUrl(key), { method: "DELETE" });
    if (res.status !== 404) await ensureOk(res, `DELETE ${key}`);
  },

  async createUploadTicket(key, contentType, expiresInSeconds): Promise<UploadTicket> {
    const signed = await s3().client.sign(
      new Request(`${objectUrl(key)}?X-Amz-Expires=${expiresInSeconds}`, {
        method: "PUT",
        headers: { "Content-Type": contentType },
      }),
      { aws: { signQuery: true } },
    );
    return {
      url: signed.url.toString(),
      method: "PUT",
      headers: { "Content-Type": contentType },
      key,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    };
  },
};
