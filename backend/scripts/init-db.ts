import { exec } from "child_process";
import { promisify } from "util";
import { PrismaClient } from "@prisma/client";

const execAsync = promisify(exec);
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
      );
    `;

    const tableExists = (result as any[])[0].exists;

    if (tableExists) {
      console.log("[DB INIT] User table already exists, skipping initialization");
      await prisma.$disconnect();
      return;
    }

    console.log("[DB INIT] User table not found, running prisma db push...");

    try {
      const { stdout, stderr } = await execAsync("npx prisma db push --skip-generate", {
        cwd: process.cwd(),
        env: process.env,
      });

      console.log("[DB INIT] Prisma db push output:", stdout);
      if (stderr) console.log("[DB INIT] Prisma db push stderr:", stderr);
      console.log("[DB INIT] Database initialized successfully");
    } catch (error) {
      console.error("[DB INIT] Prisma db push failed:", error);
      throw error;
    }
  } catch (error) {
    console.error("[DB INIT] Fatal error during database initialization:", error);
    await prisma.$disconnect();
    process.exit(1);
  }

  await prisma.$disconnect();
}

initDb().catch((error) => {
  console.error("[DB INIT] Initialization failed:", error);
  process.exit(1);
});
