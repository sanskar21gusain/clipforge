import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const destDir = path.join(rootDir, 'public', 'ffmpeg');

if (!fs.existsSync(srcDir)) {
  console.error(`[copy-ffmpeg] Source directory not found: ${srcDir}`);
  console.error('[copy-ffmpeg] Please ensure @ffmpeg/core is installed in dependencies.');
  process.exit(1);
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

for (const file of files) {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);

  if (!fs.existsSync(src)) {
    console.error(`[copy-ffmpeg] Missing expected file: ${src}`);
    process.exit(1);
  }

  fs.copyFileSync(src, dest);
  const stat = fs.statSync(dest);
  console.log(`[copy-ffmpeg] Copied ${file} -> public/ffmpeg/${file} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
}

console.log('[copy-ffmpeg] Self-hosted FFmpeg core files successfully copied to public/ffmpeg/');
