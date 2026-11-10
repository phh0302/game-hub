import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: "puzzle", vi: "Giải đố", en: "Puzzle" },
  { slug: "arcade", vi: "Arcade", en: "Arcade" },
  { slug: "action", vi: "Hành động", en: "Action" },
  { slug: "casual", vi: "Giải trí", en: "Casual" },
  { slug: "card", vi: "Thẻ bài", en: "Card" },
  { slug: "strategy", vi: "Chiến thuật", en: "Strategy" },
];

async function seedCategories() {
  for (const [index, c] of CATEGORIES.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { slug: c.slug, sortOrder: index },
    });
    for (const [locale, name] of [["vi", c.vi], ["en", c.en]] as const) {
      await prisma.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: category.id, locale } },
        // Không ghi đè tên admin đã sửa – seed chạy lại mỗi lần deploy vẫn an toàn
        update: {},
        create: { categoryId: category.id, locale, name },
      });
    }
  }
}

/**
 * Luật chống gian lận cho bảng xếp hạng 2048:
 * - maxScore: điểm lý thuyết tối đa của 2048 ~3,9 triệu
 * - maxScorePerSecond: người chơi rất nhanh đạt khoảng 50–150 điểm/giây; 300 vẫn dư cho người thật
 */
const BOARD_2048_SETTINGS = { maxScore: 4_000_000, maxScorePerSecond: 300 };

/** Bổ sung luật mới vào DB đã có – chỉ thêm key còn thiếu, KHÔNG ghi đè giá trị admin đã chỉnh */
async function backfill2048Board() {
  const board = await prisma.leaderboard.findFirst({ where: { key: "default", game: { slug: "2048" } } });
  if (!board) return;
  const current = (board.settings ?? {}) as Record<string, unknown>;
  const missing = Object.fromEntries(Object.entries(BOARD_2048_SETTINGS).filter(([k]) => !(k in current)));
  if (Object.keys(missing).length === 0) return;
  await prisma.leaderboard.update({ where: { id: board.id }, data: { settings: { ...current, ...missing } as Prisma.InputJsonObject } });
  console.log("Đã bổ sung luật cho bảng xếp hạng 2048:", Object.keys(missing).join(", "));
}

async function seed2048(studioId: string) {
  const existing = await prisma.game.findUnique({ where: { slug: "2048" } });
  if (existing) return;

  const categories = await prisma.category.findMany({ where: { slug: { in: ["puzzle", "casual"] } } });

  const game = await prisma.game.create({
    data: {
      slug: "2048",
      studioId,
      status: "PUBLISHED",
      publishedAt: new Date(),
      thumbnailKey: "games/2048/thumbnail.svg",
      sortOrder: 1,
      settings: { minPlaySeconds: 5, maxSessionHours: 6 },
      translations: {
        create: [
          { locale: "vi", name: "2048", description: "Trượt và ghép các ô số giống nhau để đạt tới ô 2048." },
          { locale: "en", name: "2048", description: "Slide and merge matching tiles to reach the 2048 tile." },
        ],
      },
      categories: { create: categories.map((c) => ({ categoryId: c.id })) },
      leaderboards: {
        create: { key: "default", order: "DESC", settings: BOARD_2048_SETTINGS },
      },
      versions: {
        create: {
          version: "1.0.0",
          storageKey: "games/2048/1.0.0",
          entryFile: "index.html",
          sdkVersion: 1,
          status: "APPROVED",
          reviewedAt: new Date(),
          releaseNotes: "Phiên bản đầu tiên",
        },
      },
    },
    include: { versions: true },
  });

  // Đặt phiên bản 1.0.0 làm bản đang chạy
  await prisma.game.update({ where: { id: game.id }, data: { currentVersionId: game.versions[0].id } });
}

/**
 * Game mẫu chính thức (ngoài 2048). Chỉ TẠO khi chưa có – chạy lại seed không ghi đè chỉnh sửa của admin.
 * Luật chống gian lận của từng bảng xếp hạng tính theo cách chơi thật của game (xem chú thích).
 */
type SampleGame = {
  slug: string;
  sortOrder: number;
  categories: string[];
  settings: Prisma.InputJsonObject;
  board: { order: "ASC" | "DESC"; settings: Prisma.InputJsonObject };
  vi: { name: string; description: string };
  en: { name: string; description: string };
};

const SAMPLE_GAMES: SampleGame[] = [
  {
    slug: "snake",
    sortOrder: 2,
    categories: ["arcade", "casual"],
    settings: { minPlaySeconds: 3, maxSessionHours: 6 },
    // Bàn 20x20 → tối đa ~397 mồi x 10 điểm; rắn nhanh nhất 70ms/ô, mồi cách trung bình ~10 ô → < 30 điểm/giây
    board: { order: "DESC", settings: { maxScore: 4_000, maxScorePerSecond: 30 } },
    vi: { name: "Rắn săn mồi", description: "Điều khiển rắn neon ăn mồi, dài ra và nhanh dần. Đừng đâm vào tường hay chính mình!" },
    en: { name: "Neon Snake", description: "Guide the neon snake to eat, grow and speed up. Don't hit the walls or yourself!" },
  },
  {
    slug: "neon-flap",
    sortOrder: 3,
    categories: ["arcade", "action"],
    // Thua trong 1–2 giây là chuyện thường → không đặt thời gian tối thiểu, chỉ giới hạn tốc độ ghi điểm
    settings: { minPlaySeconds: 0, maxSessionHours: 6 },
    // Cột xuất hiện ~0,7 cột/giây → 1,5 điểm/giây là dư cho người thật
    board: { order: "DESC", settings: { maxScore: 100_000, maxScorePerSecond: 1.5 } },
    vi: { name: "Neon Flap", description: "Chạm để bay lên, luồn qua khe giữa các cột neon. Khe hẹp dần theo điểm!" },
    en: { name: "Neon Flap", description: "Tap to fly and thread the gaps between neon pillars. The gaps get tighter as you score!" },
  },
  {
    slug: "memory",
    sortOrder: 4,
    categories: ["puzzle", "casual", "card"],
    settings: { minPlaySeconds: 3, maxSessionHours: 1 },
    // Điểm = thời gian hoàn thành (ms), thấp là tốt. 16 thẻ không thể lật xong dưới 5 giây;
    // thời gian game báo không được ngắn hơn thời gian server đo quá 5 giây
    board: {
      order: "ASC",
      settings: { format: "duration_ms", minScore: 5_000, maxScore: 3_600_000, timedScoreSlackSeconds: 5 },
    },
    vi: { name: "Lật thẻ", description: "Lật và ghép 8 cặp thẻ giống nhau. Ai hoàn thành nhanh nhất đứng đầu bảng!" },
    en: { name: "Neon Memory", description: "Flip and match 8 pairs of cards. The fastest finish tops the leaderboard!" },
  },
];

async function seedSampleGame(studioId: string, def: SampleGame) {
  const existing = await prisma.game.findUnique({ where: { slug: def.slug } });
  if (existing) return false;
  const categories = await prisma.category.findMany({ where: { slug: { in: def.categories } } });
  const game = await prisma.game.create({
    data: {
      slug: def.slug,
      studioId,
      status: "PUBLISHED",
      publishedAt: new Date(),
      thumbnailKey: `games/${def.slug}/thumbnail.svg`,
      sortOrder: def.sortOrder,
      settings: def.settings,
      translations: {
        create: [
          { locale: "vi", ...def.vi },
          { locale: "en", ...def.en },
        ],
      },
      categories: { create: categories.map((c) => ({ categoryId: c.id })) },
      leaderboards: { create: { key: "default", order: def.board.order, settings: def.board.settings } },
      versions: {
        create: {
          version: "1.0.0",
          storageKey: `games/${def.slug}/1.0.0`,
          entryFile: "index.html",
          sdkVersion: 1,
          status: "APPROVED",
          reviewedAt: new Date(),
          releaseNotes: "Phiên bản đầu tiên",
        },
      },
    },
    include: { versions: true },
  });
  await prisma.game.update({ where: { id: game.id }, data: { currentVersionId: game.versions[0].id } });
  return true;
}

async function main() {
  await seedCategories();

  const studio = await prisma.studio.upsert({
    where: { slug: "game-hub" },
    update: {},
    create: { slug: "game-hub", name: "Game Hub", isOfficial: true },
  });

  await seed2048(studio.id);
  await backfill2048Board();
  const created: string[] = [];
  for (const def of SAMPLE_GAMES) if (await seedSampleGame(studio.id, def)) created.push(def.slug);
  console.log(
    `Seed xong: 6 thể loại, studio Game Hub, game 2048 + ${SAMPLE_GAMES.length} game mẫu` +
      (created.length ? ` (mới tạo: ${created.join(", ")})` : ""),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
