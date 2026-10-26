import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const standalone = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standalone, ".next", "static");
const publicSrc = path.join(root, "public");
const publicDest = path.join(standalone, "public");

if (!existsSync(standalone)) {
  console.error("Missing .next/standalone — run next build first.");
  process.exit(1);
}

mkdirSync(path.join(standalone, ".next"), { recursive: true });

if (existsSync(staticDest)) rmSync(staticDest, { recursive: true, force: true });
cpSync(staticSrc, staticDest, { recursive: true });
console.log("Copied .next/static → standalone");

if (existsSync(publicSrc)) {
  if (existsSync(publicDest)) rmSync(publicDest, { recursive: true, force: true });
  cpSync(publicSrc, publicDest, { recursive: true });
  console.log("Copied public → standalone");
}

console.log("Electron server bundle ready.");
