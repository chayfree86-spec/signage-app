import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "output");
const screenDir = path.join(outputDir, "screen");

await mkdir(screenDir, { recursive: true });
await copyFile(path.join(outputDir, "index.html"), path.join(screenDir, "index.html"));

await writeFile(
  path.join(outputDir, ".htaccess"),
  [
    "Options -MultiViews",
    "RewriteEngine On",
    "RewriteCond %{REQUEST_FILENAME} !-f",
    "RewriteCond %{REQUEST_FILENAME} !-d",
    "RewriteRule ^ index.html [L]",
    "",
  ].join("\n")
);

console.log("Prepared Vite static output for / and /screen.");
