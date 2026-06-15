#!/usr/bin/env node
/**
 * Make icon masters transparent. Reads PRISTINE originals from assets/icons-raw/
 * and writes transparent versions to assets/icons-src/ (what build-icon-pack uses).
 * icons-raw is NEVER modified — re-run any time without re-generating.
 *
 * Method:
 *   - "rembg" (default if a rembg binary is found): real foreground segmentation —
 *     clean cutouts, no white-halo. Batched via `rembg p` (model loads once).
 *   - "floodfill": dependency-free fallback that keys out border-connected white
 *     (leaves a halo on soft-glow edges; only ok for hard flat backgrounds).
 *
 * rembg binary resolution: $REMBG_BIN, else `rembg` on PATH, else a known venv.
 * Usage: node scripts/remove-bg.mjs [--method rembg|floodfill] [--threshold 238] [--only-new]
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'assets', 'icons-raw');
const outDir = path.join(root, 'assets', 'icons-src');

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const THRESHOLD = Number(arg('--threshold', 238));
const ONLY_NEW = process.argv.includes('--only-new');

function resolveRembg() {
  if (process.env.REMBG_BIN && fs.existsSync(process.env.REMBG_BIN)) return process.env.REMBG_BIN;
  const onPath = spawnSync('bash', ['-lc', 'command -v rembg'], { encoding: 'utf8' });
  if (onPath.status === 0 && onPath.stdout.trim()) return onPath.stdout.trim();
  const known = path.join(os.homedir(), 'Desktop/Apps/Fluff/.venv-rembg/bin/rembg');
  if (fs.existsSync(known)) return known;
  return null;
}

// ---- flood-fill fallback (border-connected near-white -> alpha 0) ----
export async function keyOutWhite(srcPath, destPath, threshold = THRESHOLD) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const isWhite = i => data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold;
  const bg = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, 0, x, h - 1);
  for (let y = 0; y < h; y++) stack.push(0, y, w - 1, y);
  while (stack.length) {
    const y = stack.pop(); const x = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (bg[p] || !isWhite(p * ch)) continue;
    bg[p] = 1;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  for (let p = 0; p < w * h; p++) if (bg[p]) data[p * ch + 3] = 0;
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  await sharp(data, { raw: { width: w, height: h, channels: ch } }).webp({ quality: 92, alphaQuality: 100, effort: 4 }).toFile(destPath);
}

async function main() {
  if (!fs.existsSync(rawDir)) throw new Error(`No originals at ${rawDir}. Generate icons first.`);
  const files = fs.readdirSync(rawDir).filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f));
  await fsp.mkdir(outDir, { recursive: true });

  const explicit = arg('--method', null);
  const rembg = resolveRembg();
  const method = explicit || (rembg ? 'rembg' : 'floodfill');

  if (method === 'rembg') {
    if (!rembg) throw new Error('rembg not found. Set REMBG_BIN, install rembg, or use --method floodfill.');
    // Stage inputs (optionally only-new) into a temp dir, run rembg once over the folder.
    const inDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'rembg-in-'));
    const tmpOut = await fsp.mkdtemp(path.join(os.tmpdir(), 'rembg-out-'));
    let queued = 0, skipped = 0;
    for (const f of files) {
      const dest = path.join(outDir, `${path.basename(f, path.extname(f))}.webp`);
      if (ONLY_NEW && fs.existsSync(dest)) { skipped += 1; continue; }
      await fsp.copyFile(path.join(rawDir, f), path.join(inDir, f));
      queued += 1;
    }
    if (queued) {
      console.log(`[remove-bg] rembg (${rembg}) on ${queued} icons...`);
      const r = spawnSync(rembg, ['p', inDir, tmpOut], { stdio: 'inherit' });
      if (r.status !== 0) throw new Error(`rembg failed (status ${r.status}).`);
      // rembg keeps basenames; normalize whatever it wrote into transparent webp.
      let done = 0;
      for (const o of fs.readdirSync(tmpOut)) {
        const base = path.basename(o, path.extname(o));
        await sharp(path.join(tmpOut, o)).ensureAlpha().webp({ quality: 92, alphaQuality: 100, effort: 4 })
          .toFile(path.join(outDir, `${base}.webp`));
        done += 1;
      }
      console.log(`[remove-bg] ${done} cut via rembg, ${skipped} skipped. originals untouched in assets/icons-raw/`);
    } else {
      console.log(`[remove-bg] nothing to do (${skipped} skipped).`);
    }
  } else {
    let done = 0, skipped = 0;
    for (const f of files) {
      const dest = path.join(outDir, `${path.basename(f, path.extname(f))}.webp`);
      if (ONLY_NEW && fs.existsSync(dest)) { skipped += 1; continue; }
      await keyOutWhite(path.join(rawDir, f), dest);
      done += 1;
    }
    console.log(`[remove-bg] ${done} made transparent (floodfill), ${skipped} skipped. originals untouched.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error(err); process.exit(1); });
}
