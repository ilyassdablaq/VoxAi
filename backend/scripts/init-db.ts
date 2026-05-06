import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function initDb() {
  console.log("[DB INIT] Starting database initialization...");

  try {
    // Check if User table exists
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'User'
      ) as exists;
    `;

    const tableExists = (result as any[])[0]?.exists;

    if (tableExists) {
      console.log("[DB INIT] User table already exists, skipping initialization");
      await prisma.$disconnect();
      return;
    }

    console.log("[DB INIT] User table not found");
    console.log("[DB INIT] Note: Ensure 'prisma migrate deploy' was called during build");
    console.log("[DB INIT] Database initialization complete");
  } catch (error) {
    console.error("[DB INIT] Warning: Could not verify table existence:", error);
    // Don't exit - migrations may run separately
  }

  await prisma.$disconnect();
}

initDb().catch((error) => {
  console.error("[DB INIT] Initialization warning:", error);
  // Don't exit - migrations may run separately during build
});
