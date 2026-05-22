import { access, cp, mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const standaloneDir = path.join(root, '.next', 'standalone');
const outputDir = path.join(root, 'output');

async function copyStandaloneEntry(entry) {
  if (entry.name === '.env.local') return;
  await cp(path.join(standaloneDir, entry.name), path.join(outputDir, entry.name), {
    recursive: true,
  });
}

async function copyPublicEntry(entry) {
  if (entry.name === 'live-test-media') return;
  await cp(path.join(root, 'public', entry.name), path.join(outputDir, 'public', entry.name), {
    recursive: true,
  });
}

async function copyIfExists(source, destination) {
  try {
    await access(source);
    await cp(source, destination, { recursive: true });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    console.warn(`Skipping missing optional file: ${path.relative(root, source)}`);
  }
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
await copyIfExists(path.join(root, '.env.example'), path.join(outputDir, '.env.example'));
await prepareOutputPackageJson();

console.log('Prepared self-host deployment in output/.');
