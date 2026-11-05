import { PrismaClient } from "@prisma/client";

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
        update: { name },
        create: { categoryId: category.id, locale, name },
      });
    }
  }
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
        create: { key: "default", order: "DESC", settings: { maxScore: 4_000_000 } },
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

async function main() {
  await seedCategories();

  const studio = await prisma.studio.upsert({
    where: { slug: "game-hub" },
    update: {},
    create: { slug: "game-hub", name: "Game Hub", isOfficial: true },
  });

  await seed2048(studio.id);
  console.log("Seed xong: 6 thể loại, studio Game Hub, game 2048 (v1.0.0)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
