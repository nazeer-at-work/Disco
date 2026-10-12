#!/usr/bin/env node
/**
 * Normalizes all Disco icons in assets/icons-src/ and res/drawable-nodpi/:
 * 1. Trims transparent padding to find the exact glyph bounding box.
 * 2. Centers and scales the glyph to 80% of a uniform 512x512 square transparent canvas (assets/icons-src).
 * 3. Emits 384x384 square drawables to android/app/src/main/res/drawable-nodpi/ (matching Fluffy standard).
 *
 * This ensures icons in the app listing and launchers are perfectly sized with the
 * required 10% mask safe-zone on all sides, preventing any cropping or oversized rendering.
 *
 * Usage:
 *   node scripts/normalize-icon-sizes.mjs
 *   node scripts/normalize-icon-sizes.mjs --only <slug>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'assets', 'icons-src');
const drawableDir = path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi');

const CANVAS_SIZE = 512;
const DRAWABLE_SIZE = 384;
const TARGET_RATIO = 0.80; // 80% glyph coverage, 10% breathing room on all sides
const TARGET_PX = Math.round(CANVAS_SIZE * TARGET_RATIO); // 410px
const ALPHA_THRESHOLD = 8;
const CONCURRENCY = 16;

const onlyArgIdx = process.argv.indexOf('--only');
const onlySlug = onlyArgIdx !== -1 && process.argv[onlyArgIdx + 1] ? process.argv[onlyArgIdx + 1] : null;

async function normalizeSingleIcon(filename) {
  const srcPath = path.join(srcDir, filename);
  const destDrawablePath = path.join(drawableDir, filename);

  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Fallback for completely empty images
  if (maxX < 0 || maxY < 0) {
    minX = 0;
    minY = 0;
    maxX = info.width - 1;
    maxY = info.height - 1;
  }

  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;

  // Extract the true bounding box
  const cropped = sharp(srcPath).extract({
    left: minX,
    top: minY,
    width: boxWidth,
    height: boxHeight,
  });

  // Scale so largest dimension is TARGET_PX (410px)
  const resizedBuffer = await cropped
    .resize({
      width: boxWidth >= boxHeight ? TARGET_PX : null,
      height: boxHeight > boxWidth ? TARGET_PX : null,
      fit: 'contain',
    })
    .toBuffer();

  // Composite centered on 512x512 transparent canvas
  const normalized512 = await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resizedBuffer, gravity: 'center' }])
    .webp({ quality: 95, alphaQuality: 100, effort: 4 })
    .toBuffer();

  // Write back to assets/icons-src/
  fs.writeFileSync(srcPath, normalized512);

  // Write downscaled 384x384 square to res/drawable-nodpi/
  const drawable384 = await sharp(normalized512)
    .resize(DRAWABLE_SIZE, DRAWABLE_SIZE, { fit: 'inside' })
    .webp({ quality: 90, alphaQuality: 100, effort: 4 })
    .toBuffer();

  fs.writeFileSync(destDrawablePath, drawable384);
}

async function main() {
  console.log('======================================================');
  console.log('📐 DISCO ICON NORMALIZATION');
  console.log('======================================================');
  console.log(`Canvas Target:    ${CANVAS_SIZE}x${CANVAS_SIZE} px (assets/icons-src)`);
  console.log(`Drawable Target:  ${DRAWABLE_SIZE}x${DRAWABLE_SIZE} px (drawable-nodpi)`);
  console.log(`Glyph Scale:      ${Math.round(TARGET_RATIO * 100)}% (${TARGET_PX}px max bounding box)`);
  console.log(`Safe Margin:      10% on all borders`);
  console.log('======================================================\n');

  fs.mkdirSync(drawableDir, { recursive: true });

  let files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.webp'));
  if (onlySlug) {
    const targetFile = onlySlug.endsWith('.webp') ? onlySlug : `${onlySlug}.webp`;
    files = files.filter((f) => f === targetFile);
    if (!files.length) {
      console.error(`❌ Icon not found: ${onlySlug}`);
      process.exit(1);
    }
  }

  console.log(`🔄 Processing ${files.length} icons with concurrency ${CONCURRENCY}...`);

  let completed = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const chunk = files.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (file) => {
        try {
          await normalizeSingleIcon(file);
          completed++;
        } catch (err) {
          errors++;
          console.error(`   ❌ Failed to normalize ${file}: ${err.message}`);
        }
      })
    );

    if (completed % 250 === 0 || completed === files.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = ((completed / files.length) * 100).toFixed(1);
      console.log(`   📦 [${pct}%] ${completed} / ${files.length} icons normalized (${elapsed}s)...`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n======================================================');
  console.log(`✅ Normalization complete in ${totalTime}s!`);
  console.log(`   Normalized: ${completed}`);
  console.log(`   Errors:     ${errors}`);
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('Fatal error during normalization:', err);
  process.exit(1);
});
