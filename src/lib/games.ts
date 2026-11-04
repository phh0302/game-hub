import "server-only";
import { z } from "zod";
import { GameCategory, GameStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

/** Game hiển thị cho người chơi (không gồm game bị ẩn) */
export async function findVisibleGame(slug: string) {
  const game = await prisma.game.findUnique({ where: { slug } });
  if (!game || game.status === GameStatus.HIDDEN) {
    throw new ApiError(404, "GAME_NOT_FOUND", "Không tìm thấy game");
  }
  return game;
}

/** Game đang mở để chơi (không bảo trì) */
export async function findPlayableGame(slug: string) {
  const game = await findVisibleGame(slug);
  if (game.status !== GameStatus.ACTIVE) {
    throw new ApiError(423, "GAME_UNAVAILABLE", "Game đang bảo trì");
  }
  return game;
}

export const categorySchema = z.nativeEnum(GameCategory);

/** Dữ liệu tạo game (admin) */
export const gameCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang"),
  nameVi: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().min(1).max(100),
  descriptionVi: z.string().trim().max(1000).nullable().optional(),
  descriptionEn: z.string().trim().max(1000).nullable().optional(),
  thumbnailUrl: z.string().trim().max(500).nullable().optional(),
  category: categorySchema,
  embedUrl: z.string().trim().min(1).max(500),
  status: z.nativeEnum(GameStatus).optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  maxScore: z.number().int().positive().nullable().optional(),
  minPlaySeconds: z.number().int().min(0).max(3600).optional(),
});

export const gameUpdateSchema = gameCreateSchema.partial();
