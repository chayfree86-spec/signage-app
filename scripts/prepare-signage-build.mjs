import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const buildDir = path.join(root, "dist");
const screenDir = path.join(buildDir, "screen");

await mkdir(screenDir, { recursive: true });
await copyFile(path.join(buildDir, "index.html"), path.join(screenDir, "index.html"));

await writeFile(
  path.join(buildDir, ".htaccess"),
  [
    "Options -MultiViews",
    "<IfModule mod_headers.c>",
    "  <FilesMatch \"^(index\\.html)?$\">",
    "    Header set Cache-Control \"no-store, no-cache, must-revalidate, max-age=0\"",
    "    Header set Pragma \"no-cache\"",
    "    Header set Expires \"0\"",
    "  </FilesMatch>",
    "</IfModule>",
    "RewriteEngine On",
    "RewriteCond %{REQUEST_FILENAME} !-f",
    "RewriteCond %{REQUEST_FILENAME} !-d",
    "RewriteRule ^ index.html [L]",
    "",
  ].join("\n")
);

console.log("Prepared dist for / and /screen.");
