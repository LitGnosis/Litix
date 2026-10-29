// Read-only fail-closed audit; no credentials are opened or printed.
// Run: node scripts/audit-legacy-suppliers.mjs
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const dirs = ["src/app", "src/lib"];
const ignored = new Set(["node_modules", ".next", ".git", "dist", "build"]);
const pattern = /SMMGLOB|SMMFOLLOWOM|smmglob\.com|smmfollowom\.com/i;
const failures = [];
async function walk(directory) {
  let entries;
  try { entries = await readdir(join(root, directory), { withFileTypes: true }); }
  catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile() && /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name)) {
      const source = await readFile(join(root, path), "utf8");
      if (pattern.test(source)) failures.push(relative(root, join(root, path)));
    }
  }
}
for (const directory of dirs) await walk(directory);
if (failures.length) {
  console.error("BLOCKED: legacy supplier references in active application files:");
  for (const path of failures) console.error(" - " + path);
  process.exitCode = 1;
} else {
  console.log("PASS: no legacy supplier references found in scanned application files");
}
