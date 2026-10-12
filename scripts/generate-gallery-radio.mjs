#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'assets', 'icons-raw');
const carveDir = path.join(root, 'assets', 'carve');
const batchDir = path.join(carveDir, 'batch-gallery-radio');
const promptPath = path.join(root, 'scratch', 'disco-prompt.txt');

const mfluxCmd = '/Users/nazeer/Desktop/icon packs/Fluffy/.mflux-venv/bin/mflux-generate-flux2-edit';
const modelPath = '/Users/nazeer/AI/flux-klein/flux2-klein-4b-mlx';
const refDir = '/Users/nazeer/Desktop/icon packs/Fluffy/assets/icon-generation-references';

const ICONS_TO_GENERATE = [
  { slug: 'gallery', name: 'Samsung Gallery', ref: path.join(refDir, 'generic-gallery.png') },
  { slug: 'radio', name: 'Samsung Radio', ref: path.join(refDir, 'generic-fm-radio.png') },
];

fs.mkdirSync(rawDir, { recursive: true });
fs.mkdirSync(batchDir, { recursive: true });

for (const icon of ICONS_TO_GENERATE) {
  const destRaw = path.join(rawDir, `${icon.slug}.webp`);
  const destCarve = path.join(batchDir, `${icon.slug}.webp`);

  console.log(`\n🎨 Generating: ${icon.name} (${icon.slug}) using local MLX Flux-Klein`);
  console.log(`   📸 Ref: ${icon.ref}`);

  const args = [
    '--model', modelPath,
    '--image-paths', icon.ref,
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
    fs.copyFileSync(destCarve, destRaw);
    console.log(`   ✅ [Done in ${elapsed}s] -> assets/carve/batch-gallery-radio/${icon.slug}.webp`);
  } else {
    console.error(`   ❌ [Failed] Error generating ${icon.slug}`);
    process.exit(1);
  }
}

console.log('\n✨ Generation complete! Both icons staged in assets/carve/batch-gallery-radio/');
