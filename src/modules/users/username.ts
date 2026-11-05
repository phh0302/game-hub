import { z } from "zod";

/** Tên dễ bị dùng để giả mạo quản trị viên / hệ thống */
const RESERVED = new Set(["admin", "administrator", "gamehub", "game_hub", "system", "support", "moderator", "mod", "root"]);

/**
 * Username: 3–20 ký tự a-z, 0-9, dấu _ — luôn lưu chữ thường
 * để "HaPham" và "hapham" không thể là 2 người khác nhau (chống mạo danh).
 */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Username 3–20 ký tự: chữ, số, dấu _")
  .refine((v) => !RESERVED.has(v), "Tên này không được dùng")
  .refine((v) => !/^0x[0-9a-f]*$/.test(v), "Username không được giống địa chỉ ví");
