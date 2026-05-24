import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const buildDir = path.join(root, "dist");
const assetsDir = path.join(buildDir, "assets");
const screenDir = path.join(buildDir, "screen");

await mkdir(screenDir, { recursive: true });

const indexHtml = await buildLegacyFirstIndexHtml("./assets/");
await writeFile(path.join(buildDir, "index.html"), indexHtml);
await writeFile(
  path.join(screenDir, "index.html"),
  await buildLegacyFirstIndexHtml("../assets/")
);

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

console.log("Prepared dist for / and /screen with legacy-compatible player scripts.");

async function buildLegacyFirstIndexHtml(assetPrefix) {
  const files = await readdir(assetsDir);
  const cssFile = files.find((file) => file.startsWith("index-") && file.endsWith(".css"));
  const legacyPolyfillFile = files.find((file) => file.startsWith("polyfills-legacy-") && file.endsWith(".js"));
  const legacyEntryFile = files.find((file) => file.startsWith("index-legacy-") && file.endsWith(".js"));

  if (!cssFile || !legacyPolyfillFile || !legacyEntryFile) {
    return readFile(path.join(buildDir, "index.html"), "utf8");
  }

  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '    <link rel="preconnect" href="https://fonts.googleapis.com" />',
    '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '    <link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet" />',
    "    <title>Digital Signage Controller</title>",
    `    <link rel="stylesheet" href="${assetPrefix}${cssFile}">`,
    "  </head>",
    "  <body>",
    '    <div id="root"></div>',
    `    <script src="${assetPrefix}${legacyPolyfillFile}"></script>`,
    `    <script>System.import("${assetPrefix}${legacyEntryFile}");</script>`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}
