import { z } from "zod";
import { GameStatus, ScoreOrder } from "@prisma/client";
import { locales } from "@/i18n/config";
import { gameSettingsInputSchema, leaderboardSettingsSchema } from "./settings";

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Chỉ gồm chữ thường, số và dấu gạch ngang");

/** Key file tương đối, không cho "..", không bắt đầu bằng "/" */
const storageKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((v) => !v.includes("..") && !v.startsWith("/") && !/^https?:/i.test(v), "Đường dẫn file không hợp lệ");

const translationSchema = z.object({
  locale: z.enum(locales),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).nullable().optional(),
});

export const translationsSchema = z
  .array(translationSchema)
  .min(1)
  .max(10)
  .refine((items) => new Set(items.map((i) => i.locale)).size === items.length, "Mỗi ngôn ngữ chỉ 1 bản dịch");

export const gameCreateSchema = z.object({
  slug: slugSchema,
  /** Bỏ trống = studio chính thức của Game Hub */
  studioId: z.string().min(1).optional(),
  status: z.nativeEnum(GameStatus).optional(),
  thumbnailKey: storageKeySchema.nullable().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  settings: gameSettingsInputSchema.optional(),
  translations: translationsSchema,
  categorySlugs: z.array(slugSchema).max(5).optional(),
  /** Bảng xếp hạng mặc định tạo kèm game */
  defaultLeaderboard: z
    .object({
      order: z.nativeEnum(ScoreOrder).default("DESC"),
      settings: leaderboardSettingsSchema.optional(),
    })
    .optional(),
});

export const gameUpdateSchema = gameCreateSchema.omit({ defaultLeaderboard: true }).partial();

/** Tên phiên bản dùng làm tên thư mục → cấm "..", không bắt đầu bằng dấu chấm */
export const versionNameSchema = z
  .string()
  .trim()
  .regex(/^[0-9A-Za-z][0-9A-Za-z._-]{0,29}$/, "Tên phiên bản chỉ gồm chữ, số, dấu chấm, gạch ngang")
  .refine((v) => !v.includes(".."), "Tên phiên bản không hợp lệ");

export const versionCreateSchema = z.object({
  version: versionNameSchema,
  storageKey: storageKeySchema,
  entryFile: storageKeySchema.default("index.html"),
  sizeBytes: z.number().int().nonnegative().optional(),
  sdkVersion: z.number().int().min(1).default(1),
  releaseNotes: z.string().trim().max(2000).optional(),
});

export const versionReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().trim().max(1000).optional(),
});

export type GameCreateInput = z.infer<typeof gameCreateSchema>;
export type GameUpdateInput = z.infer<typeof gameUpdateSchema>;
export type VersionCreateInput = z.infer<typeof versionCreateSchema>;
export type VersionReviewInput = z.infer<typeof versionReviewSchema>;
