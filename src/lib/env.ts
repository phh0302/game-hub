import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "Thiếu DATABASE_URL"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET phải dài tối thiểu 32 ký tự"),
  ADMIN_WALLETS: z.string().optional().default(""),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Biến môi trường không hợp lệ:", parsed.error.flatten().fieldErrors);
  throw new Error("Cấu hình .env không hợp lệ – xem log ở trên");
}

export const env = {
  ...parsed.data,
  /** Danh sách ví admin đã chuẩn hóa chữ thường */
  adminWallets: parsed.data.ADMIN_WALLETS.split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean),
};
