import { PrismaClient } from "@prisma/client";
import { spawn } from "child_process";

const prisma = new PrismaClient();

function execCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: "inherit",
      shell: true,
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    proc.on("error", (error) => {
      reject(error);
    });
  });
}

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

    console.log("[DB INIT] User table not found, running prisma migrate deploy...");

    try {
      await execCommand("node_modules/.bin/prisma", ["migrate", "deploy", "--skip-generate"]);
      console.log("[DB INIT] Database initialization successful");
    } catch (error) {
      console.error("[DB INIT] Prisma migrate deploy failed:", error);
      console.log("[DB INIT] Attempting prisma db push...");

      try {
        await execCommand("node_modules/.bin/prisma", ["db", "push", "--skip-generate", "--accept-data-loss"]);
        console.log("[DB INIT] Database initialization successful via db push");
      } catch (pushError) {
        console.error("[DB INIT] Prisma db push also failed:", pushError);
        throw pushError;
      }
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
