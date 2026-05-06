import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureExtensions() {
  console.log("[DB INIT] Ensuring required PostgreSQL extensions...");

  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log("[DB INIT] uuid-ossp extension ready");
  } catch (error) {
    console.warn("[DB INIT] Failed to create uuid-ossp extension:", error);
  }

  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS "vector";');
    console.log("[DB INIT] vector extension ready");
  } catch (error) {
    console.warn("[DB INIT] Failed to create vector extension (may need superuser):", error);
  }

  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS "pg_trgm";');
    console.log("[DB INIT] pg_trgm extension ready");
  } catch (error) {
    console.warn("[DB INIT] Failed to create pg_trgm extension:", error);
  }
}

async function main() {
  console.log("[DB INIT] Starting database extension setup...");
  await ensureExtensions();
  await prisma.$disconnect();
  console.log("[DB INIT] Extension setup complete");
}

main().catch((error) => {
  console.error("[DB INIT] Fatal error:", error);
  process.exit(1);
});
