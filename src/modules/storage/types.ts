export type UploadTicket = {
  /** URL trình duyệt gửi file lên (PUT) */
  url: string;
  method: "PUT";
  /** Header bắt buộc gửi kèm (chữ ký có kiểm tra Content-Type) */
  headers: Record<string, string>;
  key: string;
  expiresAt: string;
};

export interface StorageDriver {
  readonly name: "local" | "s3";
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** null nếu không có file */
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  /** Link ký sẵn để trình duyệt upload thẳng lên kho (không qua server web – Vercel giới hạn 4,5MB/request) */
  createUploadTicket(key: string, contentType: string, expiresInSeconds: number): Promise<UploadTicket>;
}
