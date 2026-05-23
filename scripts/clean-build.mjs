import { rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

await Promise.all([
  rm(path.join(root, 'dist'), { force: true, recursive: true }),
  rm(path.join(root, 'output'), { force: true, recursive: true }),
]);

console.log('Removed dist and output build directories.');
