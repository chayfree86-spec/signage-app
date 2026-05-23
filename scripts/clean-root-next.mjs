import { rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

await rm(path.join(root, ".next"), { force: true, recursive: true });

console.log("Removed temporary root .next build directory. Use output/ for deployment.");
