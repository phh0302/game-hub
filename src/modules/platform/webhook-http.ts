/**
 * Gửi webhook tới máy chủ của developer mà không để bị lợi dụng gọi vào mạng nội bộ (SSRF).
 *
 * Kiểm tra DNS rồi mới fetch là chưa đủ: tên miền có thể trả IP công khai lúc kiểm tra và IP nội bộ
 * lúc kết nối (DNS rebinding). Ở đây việc kiểm tra nằm NGAY TRONG hàm lookup mà socket dùng để kết nối
 * → địa chỉ được kiểm tra chính là địa chỉ được kết nối. Không đi theo redirect.
 */
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import { isPrivateAddress } from "./webhook-utils.ts";

export class PrivateAddressError extends Error {
  code = "WEBHOOK_PRIVATE_ADDRESS";
  constructor() {
    super("Địa chỉ webhook trỏ vào mạng nội bộ");
  }
}

type Resolver = (hostname: string, cb: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void) => void;

const systemResolver: Resolver = (hostname, cb) => dns.lookup(hostname, { all: true }, cb);

/** Hàm lookup cho socket: phân giải tên miền, từ chối nếu BẤT KỲ địa chỉ nào là nội bộ */
export function safeLookup(resolve: Resolver = systemResolver): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname, (err, addresses) => {
      if (err) return callback(err, "", 0);
      const family = typeof options === "object" && options?.family ? Number(options.family) : 0;
      const list = family ? addresses.filter((a) => a.family === family) : addresses;
      if (list.length === 0) return callback(Object.assign(new Error(`ENOTFOUND ${hostname}`), { code: "ENOTFOUND" }), "", 0);
      if (list.some((a) => isPrivateAddress(a.address))) return callback(new PrivateAddressError(), "", 0);
      if (typeof options === "object" && options?.all) {
        (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
      } else {
        callback(null, list[0]!.address, list[0]!.family);
      }
    });
  };
}

export type PostResult = { status: number };

/** POST body tới url; trả về mã HTTP (không đọc nội dung trả về). Lỗi mạng / quá giờ / địa chỉ nội bộ → throw */
export function postWebhook(
  url: URL,
  headers: Record<string, string>,
  body: string,
  options: { timeoutMs: number; allowPrivate?: boolean; resolver?: Resolver },
): Promise<PostResult> {
  if (url.protocol !== "https:" && url.protocol !== "http:") return Promise.reject(new Error("Webhook chỉ hỗ trợ http/https"));
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // IP viết thẳng trong URL: socket không gọi lookup → kiểm tra ở đây
  if (!options.allowPrivate && isIP(host) && isPrivateAddress(host)) return Promise.reject(new PrivateAddressError());

  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: "POST",
        headers: { ...headers, "content-length": String(Buffer.byteLength(body)) },
        lookup: options.allowPrivate ? undefined : safeLookup(options.resolver),
        timeout: options.timeoutMs,
        agent: false, // không dùng lại kết nối cũ (mỗi lần gửi đều kiểm tra địa chỉ)
      },
      (res) => {
        res.resume(); // bỏ nội dung trả về
        resolve({ status: res.statusCode ?? 0 });
      },
    );
    const tooSlow = () => req.destroy(new Error(`Quá ${Math.round(options.timeoutMs / 1000)} giây không phản hồi`));
    // timeout của socket chỉ tính lúc im lặng → thêm hạn tổng cho cả lần gửi
    const timer = setTimeout(tooSlow, options.timeoutMs);
    req.on("timeout", tooSlow);
    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.on("response", () => clearTimeout(timer));
    req.end(body);
  });
}
