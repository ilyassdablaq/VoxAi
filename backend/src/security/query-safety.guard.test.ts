import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = path.resolve(__dirname, "..");

async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", "dist"].includes(entry.name)) {
        continue;
      }
      files.push(...(await collectTsFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("query safety guard", () => {
  it("prevents interpolated SQL strings in prisma unsafe raw queries", async () => {
    const files = await collectTsFiles(ROOT_DIR);
    const offenders: string[] = [];

    for (const filePath of files) {
      const source = await readFile(filePath, "utf8");
      const hasInterpolatedUnsafeSql = /\$(?:query|execute)RawUnsafe\s*\(\s*`(?:[^`\\]|\\.)*\$\{/.test(source);
      if (hasInterpolatedUnsafeSql) {
        offenders.push(path.relative(ROOT_DIR, filePath));
      }
    }

    expect(offenders).toEqual([]);
  });

  it("prevents high-risk dynamic code execution sinks", async () => {
    const files = await collectTsFiles(ROOT_DIR);
    const offenders: string[] = [];
    const sinkPattern = /\beval\s*\(|\bnew\s+Function\s*\(|\bexec\s*\(|\bspawn\s*\(/;

    for (const filePath of files) {
      const source = await readFile(filePath, "utf8");
      if (sinkPattern.test(source)) {
        offenders.push(path.relative(ROOT_DIR, filePath));
      }
    }

    expect(offenders).toEqual([]);
  });
});
