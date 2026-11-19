// Salin web/ -> dist/ dan suntik shim mobile ke setiap fail HTML.
// Fail asal dalam web/ tak diusik, jadi folder web/ boleh terus disegerak dengan repo GitHub.
import { cpSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'web');
const OUT = join(root, 'dist');
const SHIM = join(root, 'shim', 'jm-mobile.js');
const TAG = '<script src="/jm-mobile.js"></script>';

if (!existsSync(join(SRC, 'index.html'))) {
  console.error('[prepare-web] web/index.html tak jumpa. Salin isi repo JurukurMahabob ke folder web/.');
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true, filter: (p) => !/(^|[\\/])\.git([\\/]|$)/.test(p) });
cpSync(SHIM, join(OUT, 'jm-mobile.js'));

let count = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.html?$/i.test(name)) continue;
    let html = readFileSync(p, 'utf8');
    if (html.includes(TAG)) continue;
    // Shim mesti jalan SEBELUM skrip halaman, jadi letak terus selepas <head>.
    html = /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (m) => `${m}\n${TAG}`)
      : `${TAG}\n${html}`;
    writeFileSync(p, html);
    count++;
  }
};
walk(OUT);
console.log(`[prepare-web] ${count} fail HTML disuntik shim -> dist/`);
