import { copyFile, readdir } from "node:fs/promises";
import path from "node:path";

const chunksDir = path.join(process.cwd(), ".next", "static", "chunks");

const staleCssNames = [
  "09jeiv3l7w~ln.css",
  "0p~529ay_v_vt.css",
];

const stalePrimaryJsNames = [
  "0~z6qwg5y.4pf.js",
  "12o80nj3ylbdd.js",
];

const staleSecondaryJsNames = [
  "0ghbg6e__w441.js",
  "008062lc4wcrk.js",
  "09eko-gfwnyhl.js",
];

const files = await readdir(chunksDir);

const cssSource = files
  .filter((file) => file.endsWith(".css"))
  .sort()
  .at(0);

const primaryJsSource = files.find((file) => /^0\..+\.js$/.test(file));
const secondaryJsSource = files.find((file) => /^14h5\..+\.js$/.test(file));

async function copyCompat(source, targets) {
  if (!source) return;

  await Promise.all(
    targets.map((target) =>
      copyFile(path.join(chunksDir, source), path.join(chunksDir, target))
    )
  );
}

await copyCompat(cssSource, staleCssNames);
await copyCompat(primaryJsSource, stalePrimaryJsNames);
await copyCompat(secondaryJsSource ?? primaryJsSource, staleSecondaryJsNames);

console.log("Prepared stale chunk compatibility files.");
