import { PrismaClient, GameCategory, GameStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.game.upsert({
    where: { slug: "2048" },
    update: {},
    create: {
      slug: "2048",
      nameVi: "2048",
      nameEn: "2048",
      descriptionVi: "Trượt và ghép các ô số giống nhau để đạt tới ô 2048.",
      descriptionEn: "Slide and merge matching tiles to reach the 2048 tile.",
      thumbnailUrl: "/games/2048/thumbnail.svg",
      category: GameCategory.PUZZLE,
      embedUrl: "/games/2048/index.html",
      status: GameStatus.ACTIVE,
      sortOrder: 1,
      maxScore: 4_000_000,
      minPlaySeconds: 5,
    },
  });

  console.log("Seed xong: đã tạo game 2048");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
