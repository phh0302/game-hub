import "server-only";
import { localStorageDriver } from "./local";
import { s3StorageDriver } from "./s3";
import type { StorageDriver } from "./types";

/** STORAGE_DRIVER=local (mặc định, máy dev) | s3 (production: Cloudflare R2 / S3) */
export function storage(): StorageDriver {
  return process.env.STORAGE_DRIVER === "s3" ? s3StorageDriver : localStorageDriver;
}

export type { StorageDriver, UploadTicket } from "./types";
