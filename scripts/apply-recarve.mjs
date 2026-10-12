#!/usr/bin/env node
/**
 * Applies recarve and delete actions on the Disco icon pack.
 *
 * Usage:
 *   node scripts/apply-recarve.mjs --file recarve_actions.json
 *   node scripts/apply-recarve.mjs --recarve "app1,app2" --delete "app3"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'assets', 'icons-raw');
const srcDir = path.join(root, 'assets', 'icons-src');
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi');
const carveDir = path.join(root, 'assets', 'carve');
const manifestPath = path.join(carveDir, 'carve_batches_manifest.json');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('-')) {
    return args[idx + 1];
  }
  return fallback;
};

const BATCH_SIZE = parseInt(getArg('--size', '100'), 10);
const jsonFile = getArg('--file', null);
const recarveArg = getArg('--recarve', '');
const deleteArg = getArg('--delete', '');

let recarveSlugs = new Set();
let deleteSlugs = new Set();

if (jsonFile) {
  const filePath = path.resolve(jsonFile);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Actions file not found: ${filePath}`);
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (Array.isArray(payload)) {
    // Array of slugs default to recarve
    payload.forEach((s) => recarveSlugs.add(s));
  } else {
    (payload.recarve || []).forEach((s) => recarveSlugs.add(s));
    (payload.delete || []).forEach((s) => deleteSlugs.add(s));
  }
}

if (recarveArg) {
  recarveArg.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => recarveSlugs.add(s));
}
if (deleteArg) {
  deleteArg.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => deleteSlugs.add(s));
}

// Slugs marked for delete shouldn't also be recarved
for (const s of deleteSlugs) {
  recarveSlugs.delete(s);
}

console.log(`\n======================================================`);
console.log(`🪩  APPLYING RECARVE & DELETE ACTIONS`);
console.log(`======================================================`);
console.log(`🔄 Slugs to recarve: ${recarveSlugs.size}`);
console.log(`🗑️ Slugs to delete:  ${deleteSlugs.size}`);

if (recarveSlugs.size === 0 && deleteSlugs.size === 0) {
  console.log(`ℹ️  No actions specified.`);
  process.exit(0);
}

// 1. Process Deletions
let deletedCount = 0;
for (const slug of deleteSlugs) {
  const srcFile = path.join(srcDir, `${slug}.webp`);
  const resFile = path.join(resDir, `${slug}.webp`);
  if (fs.existsSync(srcFile)) {
    fs.unlinkSync(srcFile);
    deletedCount++;
  }
  if (fs.existsSync(resFile)) {
    fs.unlinkSync(resFile);
  }
}
if (deletedCount > 0) {
  console.log(`🗑️ Removed ${deletedCount} icons from assets/icons-src/ and res/drawable-nodpi/`);
}

function findRawFile(slug) {
  const p1 = path.join(rawDir, `${slug}.webp`);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(rawDir, `${slug.replace(/_/g, '-')}.webp`);
  if (fs.existsSync(p2)) return p2;
  const p3 = path.join(rawDir, `${slug.replace(/-/g, '_')}.webp`);
  if (fs.existsSync(p3)) return p3;
  return null;
}

// 2. Process Recarve
let recarveBatches = [];
if (recarveSlugs.size > 0) {
  const validRecarve = [];
  const missingRaw = [];

  for (const slug of recarveSlugs) {
    const rawFile = findRawFile(slug);
    if (rawFile) {
      validRecarve.push({ slug, rawFile });
    } else {
      missingRaw.push(slug);
    }
  }

  if (missingRaw.length > 0) {
    console.warn(`⚠️ Warning: ${missingRaw.length} icons marked for recarve had no raw file in assets/icons-raw/:`, missingRaw);
  }

  // Remove old flawed cutouts from icons-src so they don't remain as approved masters
  for (const { slug } of validRecarve) {
    const srcFile = path.join(srcDir, `${slug}.webp`);
    const resFile = path.join(resDir, `${slug}.webp`);
    if (fs.existsSync(srcFile)) fs.unlinkSync(srcFile);
    if (fs.existsSync(resFile)) fs.unlinkSync(resFile);
  }

  // Stage into batch-recarve folders (100 per folder)
  const totalBatches = Math.ceil(validRecarve.length / BATCH_SIZE);
  console.log(`\n📦 Staging ${validRecarve.length} recarve icons into ${totalBatches} batch folder(s)...`);

  let manifest = { batches: {} };
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {}
  }

  for (let b = 0; b < totalBatches; b++) {
    const batchName = totalBatches === 1 ? 'batch-recarve' : `batch-recarve-${String(b + 1).padStart(2, '0')}`;
    const batchFolder = path.join(carveDir, batchName);
    fs.mkdirSync(batchFolder, { recursive: true });

    const slice = validRecarve.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    for (const item of slice) {
      fs.copyFileSync(item.rawFile, path.join(batchFolder, `${item.slug}.webp`));
    }

    manifest.batches[batchName] = {
      count: slice.length,
      isRecarve: true,
      files: slice.map((item) => `${item.slug}.webp`),
      stagedAt: new Date().toISOString(),
    };
    recarveBatches.push(batchName);
    console.log(`   📂 assets/carve/${batchName}: ${slice.length} icons ready for Carve`);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

// 3. Sync Pack
console.log(`\n🔄 Running pack synchronization to update manifests & appfilter...`);
execSync('node scripts/sync-pack.mjs', { cwd: root, stdio: 'inherit' });

console.log(`\n======================================================`);
console.log(`✅ ACTION EXECUTION COMPLETED!`);
if (recarveBatches.length > 0) {
  console.log(`📁 Recarve batch folders created in:`);
  recarveBatches.forEach((b) => console.log(`   - assets/carve/${b}`));
  console.log(`⚡ You can upload these batch folders to Carve, and run 'npm run carve:import' once done.`);
}
console.log(`======================================================\n`);
