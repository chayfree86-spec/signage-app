import { cp, mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const standaloneDir = path.join(root, '.next', 'standalone');
const outputDir = path.join(root, 'output');
const skippedPublicFiles = new Set([
  'file.svg',
  'globe.svg',
  'next.svg',
  'vercel.svg',
  'window.svg',
]);

async function copyStandaloneEntry(entry) {
  if (entry.name === '.env.local') return;
  await cp(path.join(standaloneDir, entry.name), path.join(outputDir, entry.name), {
    recursive: true,
  });
}

async function copyPublicEntry(entry) {
  if (entry.name === 'live-test-media' || skippedPublicFiles.has(entry.name)) return;
  await cp(path.join(root, 'public', entry.name), path.join(outputDir, 'public', entry.name), {
    recursive: true,
  });
}

async function prepareOutputPackageJson() {
  const packageJsonPath = path.join(outputDir, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  packageJson.scripts = {
    ...packageJson.scripts,
    start: 'node server.js',
  };
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

await rm(outputDir, { force: true, recursive: true });
await mkdir(path.join(outputDir, '.next'), { recursive: true });
await mkdir(path.join(outputDir, 'public'), { recursive: true });

await Promise.all((await readdir(standaloneDir, { withFileTypes: true })).map(copyStandaloneEntry));
await cp(path.join(root, '.next', 'static'), path.join(outputDir, '.next', 'static'), {
  recursive: true,
});

await Promise.all((await readdir(path.join(root, 'public'), { withFileTypes: true })).map(copyPublicEntry));
await prepareOutputPackageJson();

console.log('Prepared self-host deployment in output/.');
