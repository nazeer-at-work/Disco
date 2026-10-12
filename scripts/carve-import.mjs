#!/usr/bin/env node
/**
 * Import carved transparent cutouts into assets/icons-src/<slug>.webp.
 * Handles single files, folders, and extracted folders from carve.photos / Photorooms.
 * Also detects any skipped carve icons and isolates them in assets/carve/batch-skipped.
 *
 * Usage:
 *   node scripts/carve-import.mjs                          # scans ~/Downloads/images or ~/Downloads
 *   node scripts/carve-import.mjs --src ~/Downloads/batch-01
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const defaultPaths = [
  path.join(process.env.HOME, 'Downloads', 'images'),
  path.join(process.env.HOME, 'Downloads'),
];

let srcDir = arg('--src', defaultPaths.find(p => fs.existsSync(p)) || defaultPaths[0]);
const rawDir = path.join(root, 'assets', 'icons-raw');
const outDir = path.join(root, 'assets', 'icons-src');
const carveDir = path.join(root, 'assets', 'carve');
const manifestPath = path.join(carveDir, 'carve_batches_manifest.json');

if (!fs.existsSync(srcDir)) {
  console.error(`❌ Source directory not found: ${srcDir}`);
  process.exit(1);
}

// Strip pattern for carve.photos / Photoroom / removebg downloads
const STRIP_REGEX = /-+(?:no-bg-preview|no-bg-hd|removebg-preview)(?: \([^)]+\))?(?: \(\d+\))?\.(png|webp)$/i;

// Preload Fluffy canonical icons and master catalog for slug matching
const fluffySrcDir = path.join(root, '..', 'Fluffy', 'assets', 'icons-src');
const fluffySlugs = new Set(
  fs.existsSync(fluffySrcDir)
    ? fs.readdirSync(fluffySrcDir).filter(f => f.endsWith('.webp')).map(f => f.replace(/\.webp$/, ''))
    : []
);

const masterPaths = [
  path.join(root, '../.agents/master-catalog/arcticons_master_3000.json'),
  path.join(root, '../icon-pack/master_data/arcticons_master_3000.json'),
  '/Users/nazeer/Desktop/icon packs/.agents/master-catalog/arcticons_master_3000.json',
];
const masterPath = masterPaths.find(p => fs.existsSync(p));
const masterSlugs = new Set();
if (masterPath) {
  try {
    const rawMaster = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    const apps = Array.isArray(rawMaster) ? rawMaster : (rawMaster.apps || []);
    apps.forEach(a => { if (a.slug) masterSlugs.add(a.slug); });
  } catch (e) {}
}

function resolveSlug(filename) {
  let rawSlug = filename.replace(STRIP_REGEX, '');
  if (rawSlug === filename) {
    rawSlug = filename.replace(/\.(png|webp)$/i, '');
  }

  // 1. Direct match in Fluffy
  if (fluffySlugs.has(rawSlug)) return rawSlug;

  // 2. Hyphen to underscore in Fluffy
  const under = rawSlug.replace(/-/g, '_');
  if (fluffySlugs.has(under)) return under;

  // 3. Leading underscore in Fluffy (for digits)
  if (/^[0-9]/.test(rawSlug) && fluffySlugs.has(`_${rawSlug}`)) return `_${rawSlug}`;
  if (/^[0-9]/.test(under) && fluffySlugs.has(`_${under}`)) return `_${under}`;

  // 4. Direct match in Master catalog
  if (masterSlugs.has(rawSlug)) return rawSlug;
  if (masterSlugs.has(under)) return under;
  if (/^[0-9]/.test(rawSlug) && masterSlugs.has(`_${rawSlug}`)) return `_${rawSlug}`;
  if (/^[0-9]/.test(under) && masterSlugs.has(`_${under}`)) return `_${under}`;

  // 5. Fallback standard normalization
  let norm = under.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  if (/^[0-9]/.test(norm)) norm = `_${norm}`;
  if (/^_[a-z]/.test(norm)) norm = norm.replace(/^_+/, '');
  return norm;
}

function findCutoutFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && (entry.name.startsWith('batch-') || entry.name === 'images')) {
      results = results.concat(findCutoutFiles(fullPath));
    } else if (entry.isFile()) {
      if (STRIP_REGEX.test(entry.name) || /\.(png|webp)$/i.test(entry.name)) {
        if (!entry.name.startsWith('.') && entry.name !== '-.webp') {
          results.push(fullPath);
        }
      }
    }
  }
  return results;
}

const files = findCutoutFiles(srcDir);

if (!files.length) {
  console.error(`❌ No cutout images found in ${srcDir}`);
  process.exit(1);
}

// Deduplicate: If multiple files resolve to same slug (e.g. file (1).png), pick latest modified
const filesBySlug = new Map();
for (const filePath of files) {
  const f = path.basename(filePath);
  const slug = resolveSlug(f);
  const stats = fs.statSync(filePath);
  if (!filesBySlug.has(slug) || stats.mtimeMs > filesBySlug.get(slug).mtimeMs) {
    filesBySlug.set(slug, { filePath, mtimeMs: stats.mtimeMs, originalName: f });
  }
}

const namesArg = arg('--names', null);
if (namesArg) {
  const allowed = new Set(namesArg.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  for (const slug of Array.from(filesBySlug.keys())) {
    if (!allowed.has(slug)) {
      filesBySlug.delete(slug);
    }
  }
}

console.log(`\n======================================================`);
console.log(`🪩  DISCO POST-CARVE PROCESSING`);
console.log(`======================================================`);
console.log(`📂 Found ${files.length} carved cutouts in: ${srcDir}`);
if (namesArg) {
  console.log(`🎯 Targeted import for ${filesBySlug.size} icons: ${Array.from(filesBySlug.keys()).join(', ')}`);
} else {
  console.log(`✨ Resolved to ${filesBySlug.size} unique icon slugs`);
}

// Check for skipped icons from manifest (only in full scan mode)
let skippedIcons = [];
if (!namesArg && fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const stagedFiles = [];
    for (const batch of Object.values(manifest.batches || {})) {
      if (Array.isArray(batch.files)) {
        stagedFiles.push(...batch.files);
      }
    }

    for (const stagedFile of stagedFiles) {
      const stagedSlug = stagedFile.replace(/\.webp$/, '');
      const resolvedStagedSlug = resolveSlug(stagedSlug);
      if (!filesBySlug.has(stagedSlug) && !filesBySlug.has(resolvedStagedSlug)) {
        skippedIcons.push(stagedFile);
      }
    }

    if (skippedIcons.length > 0) {
      console.log(`\n⚠️  SKIPPED CARVE ICONS DETECTED: ${skippedIcons.length} icons`);
      const skippedDir = path.join(carveDir, 'batch-skipped');
      fs.mkdirSync(skippedDir, { recursive: true });

      for (const skippedFile of skippedIcons) {
        const rawPath = path.join(rawDir, skippedFile);
        if (fs.existsSync(rawPath)) {
          fs.copyFileSync(rawPath, path.join(skippedDir, skippedFile));
        }
        console.log(`   🔸 [Skipped] ${skippedFile} -> assets/carve/batch-skipped/`);
      }

      manifest.batches['batch-skipped'] = {
        count: skippedIcons.length,
        files: skippedIcons,
        reason: 'Missing from Carve download results',
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      console.log(`📁 Saved isolated skipped batch to: assets/carve/batch-skipped/`);
    } else {
      console.log(`✅ 100% of staged icons were successfully carved! (0 skipped)`);
    }
  } catch (e) {
    console.warn('Could not inspect manifest for skipped icons:', e.message);
  }
}

// Import cutouts
fs.mkdirSync(outDir, { recursive: true });
let imported = 0;
let errors = 0;

console.log(`\n🔄 Converting cutouts to WebP and importing to assets/icons-src/...`);

for (const [slug, item] of filesBySlug.entries()) {
  try {
    const { data, info } = await sharp(item.filePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0 || maxY < 0) {
      minX = 0; minY = 0; maxX = info.width - 1; maxY = info.height - 1;
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const canvasSize = 512;
    const targetPx = Math.round(canvasSize * 0.80);
    const cropped = sharp(item.filePath).extract({ left: minX, top: minY, width: bw, height: bh });
    const resized = await cropped.resize({
      width: bw >= bh ? targetPx : null,
      height: bh > bw ? targetPx : null,
      fit: 'contain',
    }).toBuffer();

    const buf = await sharp({
      create: {
        width: canvasSize,
        height: canvasSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resized, gravity: 'center' }])
      .webp({ quality: 95, alphaQuality: 100, effort: 4 })
      .toBuffer();

    fs.writeFileSync(path.join(outDir, `${slug}.webp`), buf);
    imported++;
    if (imported % 200 === 0 || imported === filesBySlug.size) {
      console.log(`   📦 Imported ${imported} / ${filesBySlug.size} icons...`);
    }
  } catch (err) {
    errors++;
    console.error(`   ❌ [Error] Could not process ${item.originalName}: ${err.message}`);
  }
}

console.log(`\n======================================================`);
// Clean up batch-recarve folder if completed
const recarveDir = path.join(carveDir, 'batch-recarve');
if (fs.existsSync(recarveDir)) {
  const recarveFiles = fs.readdirSync(recarveDir).filter((f) => f.endsWith('.webp'));
  const allImported = recarveFiles.length > 0 && recarveFiles.every((f) => fs.existsSync(path.join(outDir, f)));
  if (allImported) {
    fs.rmSync(recarveDir, { recursive: true, force: true });
    if (fs.existsSync(manifestPath)) {
      try {
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (m.batches && m.batches['batch-recarve']) {
          delete m.batches['batch-recarve'];
          fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2), 'utf8');
        }
      } catch (e) {}
    }
    console.log(`🧹 Cleared completed assets/carve/batch-recarve/ folder.`);
  }
}

// Clean up batch-samsung folder if completed
const samsungDir = path.join(carveDir, 'batch-samsung');
if (fs.existsSync(samsungDir)) {
  const samsungFiles = fs.readdirSync(samsungDir).filter((f) => f.endsWith('.webp'));
  const allImported = samsungFiles.length > 0 && samsungFiles.every((f) => fs.existsSync(path.join(outDir, f)));
  if (allImported) {
    fs.rmSync(samsungDir, { recursive: true, force: true });
    if (fs.existsSync(manifestPath)) {
      try {
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (m.batches && m.batches['batch-samsung']) {
          delete m.batches['batch-samsung'];
          fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2), 'utf8');
        }
      } catch (e) {}
    }
    console.log(`🧹 Cleared completed assets/carve/batch-samsung/ folder.`);
  }
}

// Clean up batch-gallery-radio folder if completed
const galleryRadioDir = path.join(carveDir, 'batch-gallery-radio');
if (fs.existsSync(galleryRadioDir)) {
  const grFiles = fs.readdirSync(galleryRadioDir).filter((f) => f.endsWith('.webp'));
  const allImported = grFiles.length > 0 && grFiles.every((f) => fs.existsSync(path.join(outDir, f)));
  if (allImported) {
    fs.rmSync(galleryRadioDir, { recursive: true, force: true });
    if (fs.existsSync(manifestPath)) {
      try {
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (m.batches && m.batches['batch-gallery-radio']) {
          delete m.batches['batch-gallery-radio'];
          fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2), 'utf8');
        }
      } catch (e) {}
    }
    console.log(`🧹 Cleared completed assets/carve/batch-gallery-radio/ folder.`);
  }
}

console.log('🔄 Running pack synchronization...');
execSync('node scripts/sync-pack.mjs', { cwd: root, stdio: 'inherit' });
