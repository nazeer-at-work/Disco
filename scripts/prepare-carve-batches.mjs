#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const rawDir = path.join(root, 'assets', 'icons-raw');
const srcDir = path.join(root, 'assets', 'icons-src');
const carveDir = path.join(root, 'assets', 'carve');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('-')) {
    return args[idx + 1];
  }
  return fallback;
};

const ICONS_PER_BATCH = parseInt(getArg('--size', getArg('-s', '100')), 10);
const includeAll = args.includes('--all');

if (!fs.existsSync(rawDir)) {
  console.error(`❌ Raw directory does not exist: ${rawDir}`);
  process.exit(1);
}

// 1. Identify icons to carve
const rawFiles = fs.readdirSync(rawDir).filter((f) => f.endsWith('.webp') && f !== '-.webp');
const srcFiles = new Set(
  fs.existsSync(srcDir)
    ? fs.readdirSync(srcDir).filter((f) => f.endsWith('.webp'))
    : []
);

const filesToCarve = includeAll
  ? rawFiles
  : rawFiles.filter((f) => !srcFiles.has(f));

console.log(`\n======================================================`);
console.log(`🪩  DISCO CARVE BATCH PREPARATION`);
console.log(`======================================================`);
console.log(`📁 Total in assets/icons-raw:      ${rawFiles.length}`);
console.log(`✅ Already carved in icons-src:    ${srcFiles.size}`);
console.log(`⏳ Icons to batch for carving:     ${filesToCarve.length}`);
console.log(`📦 Batch size:                     ${ICONS_PER_BATCH} icons per folder`);

if (filesToCarve.length === 0) {
  console.log(`🎉 All icons in icons-raw are already carved in assets/icons-src!`);
  process.exit(0);
}

// 2. Sort uncarved files by Arcticons/Master 3000 download rank
const masterPaths = [
  path.join(root, '../.agents/master-catalog/arcticons_master_3000.json'),
  path.join(root, '../icon-pack/master_data/arcticons_master_3000.json'),
  path.join(root, '../.agents/master-catalog/global_master_3000.json'),
  '/Users/nazeer/Desktop/Icon Packs/.agents/master-catalog/arcticons_master_3000.json',
  '/Users/nazeer/Desktop/icon packs/.agents/master-catalog/arcticons_master_3000.json',
];
const masterPath = masterPaths.find((p) => fs.existsSync(p));

let rankMap = new Map();
if (masterPath) {
  try {
    const rawMaster = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    const apps = Array.isArray(rawMaster) ? rawMaster : (rawMaster.apps || []);
    apps.forEach((a) => {
      if (a.slug) rankMap.set(a.slug, a.rank || 9999);
    });
    console.log(`📊 Prioritizing batches using master catalog download ranks.`);
  } catch (e) {}
}

filesToCarve.sort((a, b) => {
  const slugA = a.replace(/\.webp$/, '');
  const slugB = b.replace(/\.webp$/, '');
  const rankA = rankMap.get(slugA) ?? 99999;
  const rankB = rankMap.get(slugB) ?? 99999;
  if (rankA !== rankB) return rankA - rankB;
  return a.localeCompare(b);
});

// 3. Clear previous batch-* folders in assets/carve/
if (fs.existsSync(carveDir)) {
  for (const entry of fs.readdirSync(carveDir)) {
    if (/^batch-\d+$/.test(entry)) {
      fs.rmSync(path.join(carveDir, entry), { recursive: true, force: true });
    }
  }
} else {
  fs.mkdirSync(carveDir, { recursive: true });
}

// 4. Create batches
const totalBatches = Math.ceil(filesToCarve.length / ICONS_PER_BATCH);
const manifest = {
  createdAt: new Date().toISOString(),
  totalToCarve: filesToCarve.length,
  iconsPerBatch: ICONS_PER_BATCH,
  totalBatches: totalBatches,
  batches: {},
};

console.log(`\n📦 Staging ${filesToCarve.length} icons into ${totalBatches} folders...\n`);

for (let b = 0; b < totalBatches; b++) {
  const batchNum = String(b + 1).padStart(2, '0');
  const batchName = `batch-${batchNum}`;
  const batchFolder = path.join(carveDir, batchName);
  fs.mkdirSync(batchFolder, { recursive: true });

  const batchFiles = filesToCarve.slice(b * ICONS_PER_BATCH, (b + 1) * ICONS_PER_BATCH);
  manifest.batches[batchName] = {
    count: batchFiles.length,
    startRank: rankMap.get(batchFiles[0].replace(/\.webp$/, '')) ?? 'N/A',
    endRank: rankMap.get(batchFiles[batchFiles.length - 1].replace(/\.webp$/, '')) ?? 'N/A',
    files: batchFiles,
  };

  for (const file of batchFiles) {
    fs.copyFileSync(path.join(rawDir, file), path.join(batchFolder, file));
  }

  console.log(`  📂 assets/carve/${batchName}: ${batchFiles.length} icons (Ranks #${manifest.batches[batchName].startRank} - #${manifest.batches[batchName].endRank})`);
}

// 5. Write manifest
const manifestPath = path.join(carveDir, 'carve_batches_manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log(`\n======================================================`);
console.log(`✅ All ${totalBatches} carve folders created successfully!`);
console.log(`📁 Destination: assets/carve/batch-01 ... batch-${String(totalBatches).padStart(2, '0')}`);
console.log(`📄 Manifest:    assets/carve/carve_batches_manifest.json`);
console.log(`======================================================\n`);
