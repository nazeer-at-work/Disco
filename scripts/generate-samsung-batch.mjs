#!/usr/bin/env node
/**
 * Generates all missing Samsung OEM icons using the local MLX Flux-Klein model.
 * Saves raw candidate outputs to assets/icons-raw/ and stages them into assets/carve/batch-samsung/.
 *
 * Usage:
 *   node scripts/generate-samsung-batch.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'assets', 'icons-raw');
const carveDir = path.join(root, 'assets', 'carve');
const batchSamsungDir = path.join(carveDir, 'batch-samsung');
const manifestPath = path.join(carveDir, 'carve_batches_manifest.json');
const promptPath = path.join(root, 'scratch', 'disco-prompt.txt');

const mfluxCmd = '/Users/nazeer/Desktop/icon packs/Fluffy/.mflux-venv/bin/mflux-generate-flux2-edit';
const modelPath = '/Users/nazeer/AI/flux-klein/flux2-klein-4b-mlx';
const refDir = '/Users/nazeer/Desktop/icon packs/Fluffy/assets/icon-generation-references';

if (!fs.existsSync(mfluxCmd)) {
  console.error(`❌ MFLUX executable not found: ${mfluxCmd}`);
  process.exit(1);
}
if (!fs.existsSync(modelPath)) {
  console.error(`❌ Flux model not found: ${modelPath}`);
  process.exit(1);
}

// Ensure prompt exists
if (!fs.existsSync(promptPath)) {
  const content = fs.readFileSync(path.join(root, 'config', 'icon-prompt.md'), 'utf8');
  const marker = content.indexOf('---');
  const prompt = (marker !== -1 ? content.slice(marker + 3) : content).trim();
  fs.mkdirSync(path.join(root, 'scratch'), { recursive: true });
  fs.writeFileSync(promptPath, prompt, 'utf8');
}

[rawDir, batchSamsungDir].forEach((d) => fs.mkdirSync(d, { recursive: true }));

// Missing Samsung icons to generate
const MISSING_SAMSUNG_APPS = [
  { slug: 'galaxystore', name: 'Galaxy Store' },
  { slug: 'samsungpass', name: 'Samsung Pass' },
  { slug: 'samsung_cloud', name: 'Samsung Cloud' },
  { slug: 'reminder', name: 'Samsung Reminder' },
  { slug: 'mail', name: 'Samsung Email' },
  { slug: 'galaxy_themes', name: 'Galaxy Themes' },
  { slug: 'bixby_routines', name: 'Modes and Routines' },
  { slug: 'bixby_vision', name: 'Bixby Vision' },
  { slug: 'private_share', name: 'Private Share' },
  { slug: 'samsung_finder', name: 'Samsung Finder' },
  { slug: 'samsung_free', name: 'Samsung Free' },
  { slug: 'samsung_kids', name: 'Samsung Kids' },
  { slug: 'digital_wellbeing', name: 'Digital Wellbeing' },
  { slug: 'sound_assistant', name: 'Sound Assistant' },
  { slug: 'samsung_keys_cafe', name: 'Keys Cafe' },
  { slug: 'pentastic', name: 'Pentastic' },
  { slug: 'wonderland', name: 'Wonderland' },
  { slug: 'one_hand_operation', name: 'One Hand Operation +' },
  { slug: 'nice_catch', name: 'Nice Catch' },
  { slug: 'notistar', name: 'NotiStar' },
  { slug: 'samsung_good_guardians', name: 'Good Guardians' },
  { slug: 'game_plugins', name: 'Game Plugins' },
  { slug: 'arzone', name: 'AR Zone' },
  { slug: 'samsung_health_monitor', name: 'Samsung Health Monitor' },
  { slug: 'secure_wi_fi', name: 'Secure Wi-Fi' },
  { slug: 'lightbulb', name: 'Samsung Tips' },
  { slug: 'studio', name: 'Samsung Studio' },
  { slug: 'folder', name: 'Samsung My Files' },
  { slug: 'recorder', name: 'Samsung Voice Recorder' },
];

console.log(`\n======================================================`);
console.log(`🪩  LOCAL MLX GENERATION: SAMSUNG ICONS (${MISSING_SAMSUNG_APPS.length} ICONS)`);
console.log(`======================================================`);
console.log(`Model:    ${modelPath}`);
console.log(`Output:   assets/carve/batch-samsung/`);
console.log(`Fallback: assets/icons-raw/`);
console.log(`======================================================\n`);

function findRef(slug) {
  const candidates = [
    path.join(refDir, `${slug}.png`),
    path.join(refDir, `${slug}.webp`),
    path.join(refDir, `${slug.replace(/_/g, '-')}.png`),
    path.join(refDir, `${slug.replace(/-/g, '_')}.png`),
    path.join(root, 'assets', 'icon-generation-references', `${slug}.png`),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

let generated = 0;
let skippedExisting = 0;
const generatedFiles = [];

for (let i = 0; i < MISSING_SAMSUNG_APPS.length; i++) {
  const app = MISSING_SAMSUNG_APPS[i];
  const destRaw = path.join(rawDir, `${app.slug}.webp`);
  const destCarve = path.join(batchSamsungDir, `${app.slug}.webp`);

  if (fs.existsSync(destCarve) && !process.argv.includes('--overwrite')) {
    console.log(`[${i + 1}/${MISSING_SAMSUNG_APPS.length}] ⏭️  Skipping existing: ${app.name} (${app.slug}.webp)`);
    skippedExisting++;
    generatedFiles.push(`${app.slug}.webp`);
    continue;
  }

  const refPath = findRef(app.slug);
  if (!refPath) {
    console.warn(`[${i + 1}/${MISSING_SAMSUNG_APPS.length}] ⚠️  No reference found for: ${app.name} (${app.slug})`);
    continue;
  }

  console.log(`\n[${i + 1}/${MISSING_SAMSUNG_APPS.length}] 🎨 Generating: ${app.name} (${app.slug})`);
  console.log(`   📸 Ref: ${path.basename(refPath)}`);

  const args = [
    '--model', modelPath,
    '--image-paths', refPath,
    '--prompt-file', promptPath,
    '--steps', '4',
    '--width', '512',
    '--height', '512',
    '--guidance', '3.5',
    '--seed', String(Math.floor(Math.random() * 100000000)),
    '--output', destCarve,
  ];

  const startTime = Date.now();
  const res = spawnSync(mfluxCmd, args, { stdio: 'inherit' });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (res.status === 0 && fs.existsSync(destCarve)) {
    // Also copy to assets/icons-raw/
    fs.copyFileSync(destCarve, destRaw);
    generated++;
    generatedFiles.push(`${app.slug}.webp`);
    console.log(`   ✅ [Done in ${elapsed}s] -> assets/carve/batch-samsung/${app.slug}.webp`);
  } else {
    console.error(`   ❌ [Failed] Error generating ${app.slug}`);
  }
}

// Update manifest
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.batches = manifest.batches || {};
    manifest.batches['batch-samsung'] = {
      count: generatedFiles.length,
      category: 'Samsung OEM Icons',
      isNewSamsungBatch: true,
      files: generatedFiles,
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  } catch (e) {}
}

console.log(`\n======================================================`);
console.log(`🎉 GENERATION BATCH COMPLETE!`);
console.log(`   Generated: ${generated}`);
console.log(`   Skipped:   ${skippedExisting}`);
console.log(`   Total in batch-samsung: ${generatedFiles.length} / ${MISSING_SAMSUNG_APPS.length}`);
console.log(`📁 Files staged at: assets/carve/batch-samsung/`);
console.log(`======================================================\n`);
