import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const srcRenderer = resolve(rootDir, 'src/renderer');
const distRenderer = resolve(rootDir, 'dist/renderer');
const preloadPath = resolve(rootDir, 'dist/preload/shellPreload.js');

mkdirSync(distRenderer, { recursive: true });
cpSync(resolve(srcRenderer, 'index.html'), resolve(distRenderer, 'index.html'));
cpSync(resolve(srcRenderer, 'styles.css'), resolve(distRenderer, 'styles.css'));

const preloadCode = readFileSync(preloadPath, 'utf8');
if (/^\s*import\s+/m.test(preloadCode)) {
  throw new Error('dist/preload/shellPreload.js was emitted as ESM instead of CommonJS!');
}

console.log('Copied renderer static assets and verified CommonJS preload bundle.');
