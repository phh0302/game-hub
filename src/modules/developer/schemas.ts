import { z } from "zod";
import { slugSchema, translationsSchema, versionNameSchema } from "@/modules/games/schemas";

export const studioCreateSchema = z.object({
  name: z.string().trim().min(2, "Tên studio tối thiểu 2 ký tự").max(60),
  slug: slugSchema,
  description: z.string().trim().max(500).nullable().optional(),
  /** Phải tick đồng ý Điều khoản người đăng game */
  acceptTerms: z.literal(true),
});

export const memberAddSchema = z.object({
  walletAddress: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Địa chỉ ví không hợp lệ"),
});

/** Developer chỉ được sửa thông tin hiển thị – trạng thái, luật chống gian lận… do admin quyết */
export const devGameCreateSchema = z.object({
  slug: slugSchema,
  translations: translationsSchema,
  categorySlugs: z.array(slugSchema).max(5).optional(),
  /** Key ảnh bìa đã upload (u/images/<userId>/…) */
  thumbnailKey: z.string().trim().max(300).nullable().optional(),
});

export const devGameUpdateSchema = devGameCreateSchema
  .omit({ slug: true })
  .partial()
  .extend({
    /** Domain được gọi Client API khi game chạy ngoài hub (Platform API) */
    allowedOrigins: z.array(z.string().trim().max(200)).max(10).optional(),
  });

export const uploadRequestSchema = z.object({
  kind: z.enum(["build", "image"]),
  contentType: z.string().trim().max(100),
  size: z.number().int().positive(),
});

export const devVersionCreateSchema = z.object({
  version: versionNameSchema,
  /** Key file .zip vừa upload (u/incoming/<userId>/…) */
  uploadKey: z.string().trim().max(300),
  releaseNotes: z.string().trim().max(2000).optional(),
});

export type StudioCreateInput = z.infer<typeof studioCreateSchema>;
export type MemberAddInput = z.infer<typeof memberAddSchema>;
export type DevGameCreateInput = z.infer<typeof devGameCreateSchema>;
export type DevGameUpdateInput = z.infer<typeof devGameUpdateSchema>;
export type UploadRequestInput = z.infer<typeof uploadRequestSchema>;
export type DevVersionCreateInput = z.infer<typeof devVersionCreateSchema>;
