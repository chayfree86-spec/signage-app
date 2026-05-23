import { rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

await Promise.all([
  rm(path.join(root, '.next'), { force: true, recursive: true }),
  rm(path.join(root, 'output'), { force: true, recursive: true }),
]);

console.log('Removed .next and output build directories.');
