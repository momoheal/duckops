import { copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = process.argv[2];
if (!outDir) throw new Error('Provide the build output directory.');

const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const runtimePackages = Object.entries(lock.packages)
  .filter(([dir, pkg]) => dir.startsWith('node_modules/') && !pkg.dev)
  .map(([dir]) => dir);
const bundledPackages = [...new Set([...runtimePackages, 'node_modules/tailwindcss'])].sort();
const notices = ['Third-party licenses for DuckOps'];

for (const dir of bundledPackages) {
  const { name, version } = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  const files = (await readdir(dir)).filter(file => /^(licen[cs]e|notice|copying)([.-]|$)/i.test(file));
  if (!files.length) throw new Error('Missing license text for ' + name);
  const texts = await Promise.all(files.map(file => readFile(join(dir, file), 'utf8')));
  notices.push(name + ' ' + version + '\n\n' + texts.map(text => text.trim()).join('\n\n'));
}

await copyFile('LICENSE', join(outDir, 'LICENSE'));
await writeFile(join(outDir, 'third-party-licenses.txt'), notices.join('\n\n' + '-'.repeat(72) + '\n\n') + '\n');
